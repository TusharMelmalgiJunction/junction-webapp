# Deploying the Junction web app (app.junctionverse.com)

Static Vite build served by nginx on the same Ubuntu server as admin.junctionverse.com.
Files in this folder:

| File | Purpose |
|---|---|
| `nginx/app.junctionverse.com.conf` | nginx site: HTTPS, SPA routing, caching, security headers |
| `nginx/security-headers.conf` | Generated header snippet (`npm run headers:nginx`); edit `securityHeaders.js`, not this |
| `securityHeaders.js` | Source of the CSP and other headers (also used by `npm run preview`) |
| `deploy.sh` | `npm run deploy`: build, upload a timestamped release, switch `current`; `--rollback` |

## One-time setup

### 1. DNS (GoDaddy)
Add an **A record**: name `app`, value = the server's public IP (the same IP `admin.junctionverse.com`
points to — GoDaddy shows it on the `admin` record). TTL 1 hour is fine. Check it before step 3:

```bash
nslookup app.junctionverse.com
```

### 2. Server folders
```bash
sudo mkdir -p /var/www/junction-app/releases
sudo chown -R $USER:$USER /var/www/junction-app
```
(`$USER` = the account you deploy with, e.g. `ubuntu`.)

### 3. TLS certificate
nginx and certbot are already used for admin. Get a certificate without touching existing sites:
```bash
sudo certbot certonly --nginx -d app.junctionverse.com
```
Renewal is automatic (the existing certbot timer covers it).

### 4. nginx site
Copy the two files from `deploy/nginx/` to the server, then:
```bash
sudo cp security-headers.conf /etc/nginx/snippets/junction-app-security-headers.conf
sudo cp app.junctionverse.com.conf /etc/nginx/sites-available/app.junctionverse.com
sudo ln -s /etc/nginx/sites-available/app.junctionverse.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
If `nginx -t` complains about `options-ssl-nginx.conf` or `ssl-dhparams.pem`, the server's certbot
setup doesn't use them; delete those two lines.

### 5. Firebase Web app (recommended before launch)
The site currently uses the iOS app's Firebase API key (the "web" key in the Flutter config belongs to
another project). In the Firebase console → project `junction-e0625` → Project settings → Add app →
Web. Put its `apiKey` and `appId` into `.env.production` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`),
then in Google Cloud console → Credentials restrict that key to HTTP referrer `https://app.junctionverse.com/*`
(and `http://localhost:5174/*` for development).

## Every deploy

From this folder's parent (`junction-app/`), in Git Bash:
```bash
DEPLOY_HOST=ubuntu@<server-ip> DEPLOY_SSH_KEY=~/.ssh/<key>.pem npm run deploy
```
The build refuses to run if `VITE_API_BASE_URL` is missing or not https. `.env.local` also applies to
builds, so don't put localhost URLs in it on the machine you deploy from.

Roll back to the previous release instantly:
```bash
DEPLOY_HOST=ubuntu@<server-ip> DEPLOY_SSH_KEY=~/.ssh/<key>.pem npm run deploy -- --rollback
```

## After the first deploy

- Open https://app.junctionverse.com, log in, open a listing, open chats and send a message. Then
  reload on a deep link (e.g. `/chats`) to confirm SPA routing.
- Browser DevTools → Console should show no `Content-Security-Policy` errors. If something the app
  needs is blocked, add the origin to `securityHeaders.js`, run `npm run headers:nginx`, copy the
  snippet to the server and reload nginx.
- Check headers: `curl -sI https://app.junctionverse.com | grep -i -E "content-security|strict-transport"`
- When CORS is restricted on the API later, include `https://app.junctionverse.com` in
  `CORS_ALLOWED_ORIGINS`.

## Test locally with production headers

```bash
npm run build && npm run preview     # http://localhost:4174, same CSP as production
```
