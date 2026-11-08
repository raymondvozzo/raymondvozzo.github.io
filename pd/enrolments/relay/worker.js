// Cloudflare Worker: lets the enrolments page start the "Update class enrolments" workflow for ONE course.
// Settings (Worker > Settings > Variables): GITHUB_TOKEN (secret), OWNER, REPO, ALLOWED_ORIGIN.
const COURSE = /^[A-Z]{3,5}\d{3,4}$/;
export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || req.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response('No', { status: 403, headers: cors });
    const { course } = await req.json().catch(() => ({}));
    if (!COURSE.test(course || '')) return new Response('Bad course', { status: 400, headers: cors });
    const r = await fetch(`https://api.github.com/repos/${env.OWNER}/${env.REPO}/actions/workflows/enrolments.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'enrolments-relay', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref: 'main', inputs: { course } })
    });
    return new Response(r.ok ? 'Started' : 'GitHub said ' + r.status, { status: r.ok ? 200 : 502, headers: cors });
  }
};
