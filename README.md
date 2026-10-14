# Junction web app

Student marketplace web client. Same stack as `junction-web`: React, TypeScript, and Vite.

## Run locally

```bash
npm install
npm run dev
```

The app serves on http://localhost:5174. In development it talks to the production API through the Vite proxy (`/prod-api` → `https://api.junctionverse.com`, see `vite.config.ts` and `.env.development`), so the API's CORS allow-list doesn't need to include localhost. To use a local backend instead, put `VITE_API_BASE_URL=http://localhost:3000` in `.env.development.local`.

Production builds read `.env.production`. Deployment: `deploy/DEPLOY.md`.

Chat uses the same Firestore schema as the Flutter app when Firebase custom-token sign-in succeeds. If that sign-in fails, chats fall back to the REST chat endpoints.

Auctions are out of scope for this phase.
