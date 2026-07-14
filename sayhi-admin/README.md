# SayHi Likes Admin (Vercel)

## Env
```
ADMIN_TOKEN=Jackson1?
BLOB_READ_WRITE_TOKEN=   # from Vercel Storage → Blob (required for video upload)
```

## Local
```bash
cd sayhi-admin
npm install
npm run dev
```
Open http://localhost:3000/admin/login

## Deploy
```bash
npx vercel
```
Set the same env vars in the Vercel project.

## Android
Set `ApiClient.baseUrl` in the app to your Vercel URL, rebuild APK.
