// PD staff area: shared unlock code for every page under /pdstaff/.
//
// How it works (see encryption.md in the project for the full story):
//   /pdstaff/keyring.json  a random 256-bit "master key", encrypted (wrapped) with a key
//                          derived from the staff password (PBKDF2-SHA256, 600,000 rounds).
//   <page>/data.enc.json   that page's data, encrypted with the master key (AES-256-GCM).
//   Logging in = unwrap the master key once with the password. The master key (never the
//   password) is then kept in this browser so every protected page can open its data.
//
// A protected page does:
//   <script src="/pdstaff/gate.js"></script>
//   Staff.open('data.enc.json').then(files => { ...files['name.csv'] is the text of that file... });
// If the browser isn't unlocked, Staff.open sends the user to /pdstaff/ and back again afterwards.

(function () {
  const KEY_NAME = 'pdstaff-key';
  const LOGIN = '/pdstaff/';

  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64e = u => { const a = new Uint8Array(u); let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return btoa(s); };
  const store = {   // sessionStorage = this tab only; localStorage = "remember on this computer"
    get() { try { return sessionStorage.getItem(KEY_NAME) || localStorage.getItem(KEY_NAME); } catch (_) { return null; } },
    set(v, remember) { try { (remember ? localStorage : sessionStorage).setItem(KEY_NAME, v); } catch (_) {} },
    clear() { try { sessionStorage.removeItem(KEY_NAME); localStorage.removeItem(KEY_NAME); } catch (_) {} },
  };

  function needCrypto() {
    if (!(window.crypto && crypto.subtle))
      throw new Error('this browser can only unlock the page over https:// or on http://localhost');
  }
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(url + ' could not be loaded (HTTP ' + r.status + ')');
    return r.json();
  }
  async function masterKey() {
    needCrypto();
    const raw = store.get();
    if (!raw) return null;
    try { return await crypto.subtle.importKey('raw', b64d(raw), 'AES-GCM', false, ['decrypt']); }
    catch (_) { store.clear(); return null; }
  }
  function toLogin() {
    location.replace(LOGIN + '?next=' + encodeURIComponent(location.pathname + location.search + location.hash));
  }

  // Log in: unwrap the master key with the password. Returns false for a wrong password.
  async function login(password, remember) {
    needCrypto();
    const kr = await getJSON(LOGIN + 'keyring.json');
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const kek = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64d(kr.salt), iterations: kr.iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    let raw;
    try { raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(kr.iv) }, kek, b64d(kr.wrapped)); }
    catch (_) { return false; }
    store.clear();
    store.set(b64e(raw), remember);
    return true;
  }

  // Open a page's encrypted data. Resolves to { 'file name': 'file text', ... }.
  async function open(url) {
    const key = await masterKey();
    if (!key) { toLogin(); return new Promise(() => {}); }   // never resolves: we're leaving
    const enc = await getJSON(url);
    let plain;
    try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, key, b64d(enc.ct)); }
    catch (_) {
      // Unlocked, but this file was encrypted under a different password: log in again.
      store.clear(); toLogin(); return new Promise(() => {});
    }
    return JSON.parse(new TextDecoder().decode(plain)).files;
  }

  function lock() { store.clear(); location.href = LOGIN; }
  async function isUnlocked() { return !!(await masterKey()); }
  function remembered() { try { return !!localStorage.getItem(KEY_NAME); } catch (_) { return false; } }

  window.Staff = { open, login, lock, isUnlocked, remembered };
})();
