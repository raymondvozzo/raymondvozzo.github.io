// Collects class enrolment numbers from the university's course pages and saves them to
// PD/enrolments/data/enrolments.json. Runs on GitHub (see .github/workflows/enrolments.yml).
//   COURSE=MATHX206   refresh just that course (several codes can be separated by spaces or commas)
//   YEAR=2027         which year's pages to read
//   SITE_ROOT=...     the repository root (default: the current folder)
//   FIXTURE_DIR=...   read saved pages (CODE.html) instead of the website, for testing
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const YEAR = process.env.YEAR || '2027';
const ROOT = process.env.SITE_ROOT || process.cwd();
const DATA = path.join(ROOT, 'PD/enrolments/data/enrolments.json');
const UA = 'Mozilla/5.0 (compatible; SchoolMathsEnrolmentsBot/1.0)';
const slug = c => c.toLowerCase().replace(/^([a-z]+)(\d+)$/, '$1-$2');
const pageUrl = c => `https://adelaide.edu.au/study/courses/${YEAR}/${slug(c)}/`;
const DATE = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}\/\d{1,2}\/\d{4}\b/g;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Reads the "Availability" section of a course page: terms > campuses > groups > classes > meeting times.
export function parseCourse(html) {
  const $ = cheerio.load(html);
  const t = el => $(el).text().replace(/\s+/g, ' ').trim();
  const all = $('body *').toArray();
  const isHead = el => /^h[1-6]$/.test(el.tagName);
  const start = all.findIndex(el => isHead(el) && /^availability$/i.test(t(el)));
  if (start < 0) return { status: 'no-availability', terms: [], headings: $('h2').toArray().map(t).slice(0, 12) };
  const level = +all[start].tagName[1];
  const terms = [];
  let term, campus, group, cls, mode = '';
  const need = () => {
    if (!term) terms.push(term = { name: 'Unknown term', campuses: [], _text: '' });
    if (!campus) term.campuses.push(campus = { name: 'Unknown campus', groups: [] });
    if (!group) campus.groups.push(group = { name: 'Group', classes: [] });
  };
  for (let i = start + 1; i < all.length; i++) {
    const el = all[i];
    if (isHead(el)) {
      const n = +el.tagName[1], s = t(el);
      if (n <= level) break;                                  // the next section (e.g. Fee calculator)
      if (n === level + 1 && !/^class details$/i.test(s)) {   // a new term, e.g. "Semester 2"
        terms.push(term = { name: s, campuses: [], _text: '' });
        campus = group = cls = null; mode = '';
      } else if (/^class details$/i.test(s)) { mode = 'classes'; campus = group = cls = null; }
      else if (mode === 'classes') {
        let m;
        if (/^group\b/i.test(s)) {
          if (!term) need();
          if (!campus) term.campuses.push(campus = { name: 'Unknown campus', groups: [] });
          campus.groups.push(group = { name: s, classes: [] }); cls = null;
        } else if ((m = s.match(/^(Enrolment class|Related class)\s*:\s*(.*)$/i))) {
          need(); group.classes.push(cls = { type: /^enrol/i.test(m[1]) ? 'Enrolment class' : 'Related class', kind: m[2], number: '', section: '', size: null, available: null, meetings: [] });
        } else if (cls && (m = s.match(/^Class number\s+(.+)$/i))) cls.number = m[1];
        else if (cls && (m = s.match(/^Section\s+(.+)$/i))) cls.section = m[1];
        else if (cls && (m = s.match(/^Size\s+(\d+)/i))) cls.size = +m[1];
        else if (cls && (m = s.match(/^Available\s+(\d+)/i))) cls.available = +m[1];
        else if (!/^(class number|section|size|available)\b/i.test(s)) {   // a campus heading
          if (!term) need();
          term.campuses.push(campus = { name: s, groups: [] }); group = cls = null;
        }
      }
    } else if (el.tagName === 'table' && cls) {
      const rows = $(el).find('tr').toArray().map(tr => $(tr).children('th,td').toArray().map(t));
      const head = (rows.shift() || []).map(h => h.toLowerCase());
      cls.meetings = rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(head.map((h, j) => [h, r[j] || ''])));
    } else if (term && mode !== 'classes' && !$(el).children().length) {
      term._text = (term._text || '') + ' ' + t(el);          // key dates are plain text before "Class details"
    }
  }
  for (const tm of terms) {                                    // the four key dates appear in this order on the page
    const found = [...new Set((tm._text || '').match(DATE) || [])];
    tm.keyDates = Object.fromEntries(['enrol', 'census', 'lastW', 'lastWF'].map((k, i) => [k, found[i] || '']).filter(([, v]) => v));
    delete tm._text;
  }
  const n = terms.reduce((a, tm) => a + tm.campuses.reduce((b, c) => b + c.groups.reduce((d, g) => d + g.classes.length, 0), 0), 0);
  return { status: n ? 'ok' : 'no-classes', terms };
}

async function getHtml(code) {
  if (process.env.FIXTURE_DIR) {
    const f = path.join(process.env.FIXTURE_DIR, code + '.html');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  }
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(pageUrl(code), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) { if (a === 3) throw e; await sleep(2000 * a); }
  }
}

async function main() {
  const codes = fs.readFileSync(path.join(ROOT, 'prereqs/courses.csv'), 'utf8').split(/\r?\n/).slice(1).map(l => l.split(',')[0].trim()).filter(Boolean);
  const prev = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : { meta: {}, courses: {} };
  const want = (process.env.COURSE || '').split(/[\s,]+/).filter(Boolean).map(s => s.toUpperCase());
  const targets = want.length ? want : codes;
  const out = prev.courses || {};
  let failed = 0, shown = false;
  for (const code of targets) {
    const now = new Date().toISOString();
    try {
      const html = await getHtml(code);
      if (html === null) out[code] = { code, url: pageUrl(code), fetched: now, status: 'no-page', terms: [] };
      else {
        const p = parseCourse(html);
        out[code] = { code, url: pageUrl(code), fetched: now, status: p.status, terms: p.terms };
        if (p.status === 'no-availability' && !shown) { shown = true; console.log(`${code}: no "Availability" heading found. Headings seen:`, p.headings); }
      }
    } catch (e) {
      failed++; console.error(`${code} FAILED: ${e.message}`);
      out[code] = { ...(out[code] || { code, url: pageUrl(code), terms: [], status: 'error' }), error: e.message, errorAt: now };
    }
    if (!process.env.FIXTURE_DIR) await sleep(1000);
  }
  const now = new Date().toISOString();
  const meta = { year: YEAR, generated: now, fullRun: want.length ? prev.meta?.fullRun || null : now };
  const sorted = Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify({ meta, courses: sorted }, null, 1) + '\n');
  const c = s => targets.filter(k => out[k].status === s).length;
  console.log(`Checked ${targets.length} course(s): ${c('ok')} with classes, ${c('no-classes')} with no classes listed, ${c('no-page')} with no page, ${c('no-availability')} without an Availability section, ${failed} failed.`);
  if (failed && failed === targets.length) process.exit(1);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
