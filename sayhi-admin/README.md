# SayHi Likes Admin (Vercel + Neon)

## Env
```
ADMIN_TOKEN=your-admin-password
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
BLOB_READ_WRITE_TOKEN=   # optional — only for how-to video uploads
```

Set the same vars in **Vercel → Project → Settings → Environment Variables** (Production), then redeploy.

## Local
```bash
cd sayhi-admin
npm install
npm run dev
```
Open http://localhost:3000/admin/login

Tables `devices` and `howto` are created automatically on first request.

## Deploy
```bash
npx vercel
```

## Android
`ApiClient.baseUrl` / `api_base_url` → your Vercel URL, rebuild APK.
