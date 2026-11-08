Optional: makes the "Refresh this course" buttons start a real update.
Without it the buttons only reload the saved file, and you refresh by hand from the repo's
Actions tab > "Update class enrolments" > Run workflow (type a course code, or leave empty for all).

1. On GitHub: Settings > Developer settings > Fine-grained tokens. Repository: only raymondvozzo.github.io.
   Permission: Actions = Read and write (nothing else). Copy the token.
2. At cloudflare.com make a free Worker, paste worker.js into it.
3. Worker > Settings > Variables: GITHUB_TOKEN (as a secret), OWNER = raymondvozzo,
   REPO = raymondvozzo.github.io, ALLOWED_ORIGIN = https://raymondvozzo.github.io
4. Put the Worker's address in REFRESH_URL near the top of pd/enrolments/index.html.
The token can only start this workflow, and the Worker only accepts course codes from your site.
