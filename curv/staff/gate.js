// Staff area: shared unlock code for every page in this folder and its sub-folders.
//   keyring.json      a random 256-bit master key, encrypted ("wrapped") with a key derived from the staff
//                     password (PBKDF2-SHA256, 600,000 rounds).
//   <page>/data.enc.json  that page's data, encrypted with the master key (AES-256-GCM).
// Logging in unwraps the master key once; the master key (never the password) is kept in this browser.
// A protected page does:  Staff.open('data.enc.json').then(files => { files['name.json'] is that file's text });
(function () {
  const me = document.currentScript && document.currentScript.src;
  const ROOT = me ? new URL('./', me).pathname : '/staff/';   // the staff folder (where gate.js lives)
  const KEY_NAME = 'hubstaff-key:' + ROOT;
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64e = u => { const a = new Uint8Array(u); let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return btoa(s); };
  const store = {
    get() { try { return sessionStorage.getItem(KEY_NAME) || localStorage.getItem(KEY_NAME); } catch (_) { return null; } },
    set(v, remember) { try { (remember ? localStorage : sessionStorage).setItem(KEY_NAME, v); } catch (_) {} },
    clear() { try { sessionStorage.removeItem(KEY_NAME); localStorage.removeItem(KEY_NAME); } catch (_) {} },
  };
  function needCrypto() {
    if (!(window.crypto && crypto.subtle)) throw new Error('this browser can only unlock the page over https:// or on http://localhost');
  }
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(url + ' could not be loaded (HTTP ' + r.status + ')');
    return r.json();
  }
  async function masterKey() {
    needCrypto();
    const raw = store.get(); if (!raw) return null;
    try { return await crypto.subtle.importKey('raw', b64d(raw), 'AES-GCM', false, ['decrypt']); } catch (_) { store.clear(); return null; }
  }
  function toLogin() { location.replace(ROOT + '?next=' + encodeURIComponent(location.pathname + location.search + location.hash)); }
  async function login(password, remember) {
    needCrypto();
    const kr = await getJSON(ROOT + 'keyring.json');
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const kek = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64d(kr.salt), iterations: kr.iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    let raw;
    try { raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(kr.iv) }, kek, b64d(kr.wrapped)); } catch (_) { return false; }
    store.clear(); store.set(b64e(raw), remember);
    return true;
  }
  async function open(url) {
    const key = await masterKey();
    if (!key) { toLogin(); return new Promise(() => {}); }
    const enc = await getJSON(url);
    let plain;
    try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, key, b64d(enc.ct)); }
    catch (_) { store.clear(); toLogin(); return new Promise(() => {}); }   // encrypted under another password
    return JSON.parse(new TextDecoder().decode(plain)).files;
  }
  function lock() { store.clear(); location.href = ROOT; }
  async function isUnlocked() { return !!(await masterKey()); }
  function remembered() { try { return !!localStorage.getItem(KEY_NAME); } catch (_) { return false; } }
  window.Staff = { open, login, lock, isUnlocked, remembered, root: ROOT };
})();
