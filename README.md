# 🌸 Nuvia — Your private AI health companion

**Track • Understand • Thrive** — an intelligent ecosystem for cycle, hormones, fertility, pregnancy and beyond, powered by AI that learns your rhythm.

## ✨ Features

- **🩸 Cycle & Hormone IQ** — AI-powered period & ovulation predictions for your unique rhythm
- **🐣 Fertility & Pregnancy** — conception tracking and trimester-aware guidance
- **🌸 PCOS & Menopause Care** — personalised plans for every life stage
- **🤖 AI Health Coach** — 24/7 conversational guidance tuned to your cycle
- **🥗 Diet Advisor** — cycle-phase-aware nutrition suggestions
- **🏋️ Fitness** — workouts adapted to your energy & cycle phase
- **✨ Skin & Beauty** — phase-aware skincare routines
- **👩‍⚕️ Doctor Finder** — find nearby gynaecologists & specialists
- **🛍️ Marketplace** — curated wellness products
- **🔔 Smart Notifications** — real notification centre with web-push support
- **🔐 Real Google Sign-In** — OAuth 2.0 authorization-code flow with server-side ID-token verification (no fake logins — every Google session is cryptographically verified)
- **📲 PWA** — installable, offline shell, web push

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons |
| Database | Prisma ORM + SQLite |
| State | Zustand (client) |
| Auth | Custom JWT sessions + Google OAuth 2.0 (google-auth-library) |
| Animations | framer-motion + vaul |
| AI | z-ai-web-dev-sdk (LLM chat, vision) |

## 🚀 Getting Started

### 1. Install

```bash
bun install
```

### 2. Configure environment

Create a `.env` file in the project root:

```bash
# Neon PostgreSQL (recommended — durable, works on Vercel + local)
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Google OAuth (create at https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret

# Session signing secret (generate: openssl rand -hex 32)
JWT_SECRET=your-random-hex-secret
```

### 3. Create the database

```bash
bun run db:push
```

### 4. Run

```bash
bun run dev
```

Open http://localhost:3000 — sign up with email, or **Continue with Google**.

## 🔑 Google Sign-In setup

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an OAuth client (type: **Web application**)
2. Add the **Authorized redirect URI**: `http://localhost:3000/api/auth/google/callback`
3. Paste the Client ID + Secret into `.env` (or use the in-app setup dialog, which shows the exact URLs)
4. Done — sign-ins are verified server-side against Google's public keys

> The app **only** accepts real Google-verified sign-ins. There is no fallback that trusts a bare email.

## 📄 License

Private project — all rights reserved.
