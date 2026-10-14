# Junction web app

Student marketplace web client. Same stack as `junction-web`: React, TypeScript, and Vite.

## Run locally

```bash
npm install
npm run dev
```

The app serves on http://localhost:5174 and talks to the API at `http://localhost:3000` unless `VITE_API_BASE_URL` is set.

Chat uses the same Firestore schema as the Flutter app when Firebase custom-token sign-in succeeds. If that sign-in fails, chats fall back to the REST chat endpoints.

Auctions are out of scope for this phase.
