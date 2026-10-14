# Deploying the Junction web app (app.junctionverse.com)

Same setup as admin.junctionverse.com: the repo lives next to the other apps on the Ubuntu server,
it's built in place, and nginx serves the build folder directly (no PM2 process).

| Server path | What |
|---|---|
| `/home/ubuntu/junction/backend/junction-webapp` | This repo (`git clone`) |
| `/home/ubuntu/junction/backend/junction-webapp/dist` | Build output nginx serves |
| `/etc/nginx/sites-available/app.junctionverse.com` | From `deploy/nginx/app.junctionverse.com.conf` |
| `/etc/nginx/snippets/junction-app-security-headers.conf` | From `deploy/nginx/security-headers.conf` |

Files in this folder:

| File | Purpose |
|---|---|
| `nginx/app.junctionverse.com.conf` | nginx site: HTTPS, SPA routing, caching, security headers |
| `nginx/security-headers.conf` | Generated header snippet (`npm run headers:nginx`); edit `securityHeaders.js`, not this |
| `securityHeaders.js` | Source of the CSP and other headers (also used by `npm run preview`) |

## One-time setup

### 1. DNS (GoDaddy)
A record `app` → the server's public IP (same as the `admin` record). Check:
```bash
dig +short app.junctionverse.com
```

### 2. TLS certificate
```bash
sudo certbot certonly --nginx -d app.junctionverse.com
```
Renewal is automatic.

### 3. Clone and build
Needs Node 20.19+ or 22.12+ (`node -v`).
```bash
cd ~/junction/backend
git clone git@github.com:TusharMelmalgiJunction/junction-webapp.git
cd junction-webapp
npm ci
npm run build
```

### 4. nginx site
```bash
sudo cp deploy/nginx/security-headers.conf /etc/nginx/snippets/junction-app-security-headers.conf
sudo cp deploy/nginx/app.junctionverse.com.conf /etc/nginx/sites-available/app.junctionverse.com
sudo ln -sf /etc/nginx/sites-available/app.junctionverse.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
Only reload if `nginx -t` reports the test is successful.

### 5. Firebase Web app (recommended before launch)
The site currently uses the iOS app's Firebase API key (the "web" key in the Flutter config belongs to
another project). In the Firebase console → project `junction-e0625` → Project settings → Add app →
Web. Put its `apiKey` and `appId` into `.env.production` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`),
then in Google Cloud console → Credentials restrict that key to HTTP referrer `https://app.junctionverse.com/*`
(and `http://localhost:5174/*` for development).

## Every deploy

```bash
cd ~/junction/backend/junction-webapp
git pull
npm ci
npm run build
```
No nginx reload is needed: nginx serves the new files immediately. While the build runs (a few
seconds) `dist` is being rewritten, so pages can briefly fail to load, the same as admin.

The build refuses to run if `VITE_API_BASE_URL` is missing or not https (it comes from the committed
`.env.production`). Don't create a `.env.local` on the server: it would override it.

To go back to an earlier version: `git checkout <commit>` then `npm ci && npm run build`
(and `git checkout main` before the next normal deploy).

If the security headers change (`securityHeaders.js`), also run `npm run headers:nginx` locally, commit,
and on the server re-copy the snippet (step 4) and reload nginx.

## After the first deploy

- Open https://app.junctionverse.com, log in, open a listing, open chats and send a message. Then
  reload on a deep link (e.g. `/chats`) to confirm SPA routing.
- Browser DevTools → Console should show no `Content-Security-Policy` errors. If something the app
  needs is blocked, add the origin to `securityHeaders.js`, run `npm run headers:nginx`, re-copy the
  snippet and reload nginx.
- Check headers: `curl -sI https://app.junctionverse.com | grep -i -E "content-security|strict-transport"`
- When CORS is restricted on the API later, include `https://app.junctionverse.com` in
  `CORS_ALLOWED_ORIGINS`.

## Test locally with production headers

```bash
npm run build && npm run preview     # http://localhost:4174, same CSP as production
```
