# PeerPays - Credit Deals Booking Platform

A full-stack platform with three role-based interfaces where **card holders** share eligible bank cards,
**bookers** place the actual Amazon/Flipkart orders using a secure **live OTP relay**, and **admins**
manage deals, users, and confirmed orders.

Built with **React + Vite + Tailwind** (frontend) and **Node/Express + MongoDB + Socket.IO** (backend).

---

## Features

### Card Holder
- Browse open deals and submit one or more saved cards to a deal.
- Manage multiple cards (numbers encrypted at rest; **CVV is never stored**).
- Track each submission's live status.
- On the OTP step: confirm with **"Go ahead"**, then enter the OTP which is relayed live to the booker. Handles resend requests.

### Booker
- Real-time feed of available deals and the card holders who submitted.
- View the shared (decrypted) card to check offer applicability, then **Accept/Reject**.
- **"Ready to send OTP"** notification, live view of the OTP as the holder types, and **Resend OTP**.
- Upload the order screenshot and mark the order complete.

### Admin
- Post and manage deals.
- Create card holder / booker accounts (username + password).
- View confirmed orders (with screenshot proof) and card holders with confirmed orders.

---

## Architecture

```
backend/     Express REST API + Socket.IO (real-time), MongoDB via Mongoose
frontend/    React (Vite) SPA with Tailwind, role-based routing, Socket.IO client
```

- **Auth:** JWT (7-day tokens), bcrypt password hashing, role-based access control on every route.
- **Real-time:** Socket.IO with per-user and per-booking rooms for notifications, booking updates, and the OTP relay.
- **Security:** Card numbers encrypted with AES-256-GCM (`CARD_ENC_KEY`). Full card revealed only to the assigned booker on an active booking; access is cut off once the order completes.

---

## Prerequisites
- Node.js 18+ (tested on v22)
- No MongoDB install required for local dev — the backend auto-starts an **in-memory MongoDB** when `MONGO_URI` is empty. Set `MONGO_URI` to use a real/persistent database.

---

## Setup & Run

Open two terminals.

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env      # then set CARD_ENC_KEY and JWT_SECRET (see below)
npm run dev               # or: npm start
```
Backend runs on **http://localhost:5050**.

Generate a card encryption key and JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # -> CARD_ENC_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # -> JWT_SECRET
```

> Note: macOS uses port 5000 for AirPlay/Control Center, so this project defaults to **5050**.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on **http://localhost:5173** and proxies `/api`, `/uploads`, and websockets to the backend.

---

## Demo Accounts

When using the default in-memory database, these are seeded automatically (also shown on the login screen):

| Role        | Username  | Password   |
|-------------|-----------|------------|
| Admin       | `admin`   | `admin123` |
| Card Holder | `holder1` | `holder123`|
| Booker      | `booker1` | `booker123`|

For a persistent DB (`MONGO_URI` set), seed the admin + demo data with:
```bash
cd backend && npm run seed
```

---

## End-to-end flow

1. **Admin** posts a deal and creates card holder / booker accounts.
2. **Card holder** adds a card and submits it to a deal.
3. **Booker** opens the deal, views the shared card, checks the offer, and Accepts.
4. **Booker** clicks "Ready to send OTP"; **card holder** clicks "Go ahead".
5. **Card holder** enters the OTP -> it appears live on the booker's screen (resend supported).
6. **Booker** uploads the order screenshot and marks it complete.
7. **Admin** sees the confirmed order and the card holder's order count.

---

## Environment variables (`backend/.env`)

| Variable         | Description |
|------------------|-------------|
| `PORT`           | API port (default 5050) |
| `CLIENT_URL`     | Frontend origin for CORS (default `http://localhost:5173`) |
| `MONGO_URI`      | MongoDB connection string. Empty = in-memory dev DB |
| `JWT_SECRET`     | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CARD_ENC_KEY`   | 64-char hex (32 bytes) AES key for card encryption |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seeded admin credentials |

---

## Deployment

To host on AWS EC2 at `yourdomain.com` (nginx + Let's Encrypt SSL + MongoDB Atlas), see
[DEPLOYMENT.md](DEPLOYMENT.md). Production config files live in `deploy/` and
`backend/.env.production.example`.

## Push notifications (PWA)

The app is an installable PWA with **Web Push** for lock-screen notifications (in-app Socket.IO
notifications always work too).

- Enable per device with the **"Enable alerts"** button in the header.
- Requires VAPID keys in `backend/.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
  Generate a pair with:
  ```bash
  node -e "console.log(require('web-push').generateVAPIDKeys())"
  ```
  Leave them empty to disable push (in-app notifications still work).
- **Secure context required:** Web Push needs HTTPS. `localhost` counts as secure for desktop testing,
  but on a real phone you must serve the site over HTTPS (deploy, or use a tunnel like ngrok/Cloudflare Tunnel).
- **iPhone:** the user must first tap Share -> "Add to Home Screen" (iOS 16.4+); after that,
  notifications appear on the lock screen. Android/desktop Chrome work without that step.
- For production polish, replace `frontend/public/icon.svg` with PNG icons (192x192, 512x512) and list
  them in `frontend/public/manifest.webmanifest`.

## Security & compliance notes
- This tool stores and relays sensitive card data and OTPs. For any production use you must review PCI-DSS
  obligations, use HTTPS, a managed secrets store, and a hardened database. Never commit a real `.env`.
- Sharing bank cards / accounts may conflict with Amazon, Flipkart, or card-issuer terms of service. Ensure
  your usage is compliant before deploying.
