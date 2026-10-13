# End-to-end checks

`e2e.mjs` drives the running stack with Playwright (Chromium, Firefox, WebKit) and
checks the subject requirements: public Privacy/Terms pages, client-side validation,
register/login/logout, i18n, profile + avatar, friends, live matchmaking with forfeit,
stats, tournaments, the public API (API key, CRUD, rate limit) and a clean browser console.

```bash
cp .env.example .env  # then fill in the values && docker compose up --build -d
set -a; . ./.env; set +a
docker run --rm --network "$(basename "$PWD")_default" \
  -e NODE_TLS_REJECT_UNAUTHORIZED=0 -e BASE=https://nginx -e PUBLIC_API_KEY=$PUBLIC_API_KEY \
  -v "$PWD/e2e:/e2e" -w /e2e mcr.microsoft.com/playwright:v1.49.1-jammy \
  bash -c "npm i playwright@1.49.1 >/dev/null 2>&1 && node e2e.mjs"
```

`NODE_TLS_REJECT_UNAUTHORIZED=0` is only needed because the dev HTTPS certificate is self-signed.
