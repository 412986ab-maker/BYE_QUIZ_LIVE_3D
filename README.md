# BYE QUIZ LIVE — Interactive TikTok LIVE Game Show Platform

BYE QUIZ LIVE is a production-grade, interactive TikTok LIVE game show platform engineered specifically for 9:16 vertical mobile screens and streaming overlays (OBS / TikTok Live Studio / TikTok LIVE Stream).

Built with native Node.js HTTP/SSE micro-architecture, PostgreSQL persistence with resilient fallback storage, GPU-accelerated Canvas particle systems, generative Web Audio synthesizers, and 100% SVG vector iconography (Zero Unicode Emojis).

---

## 🚀 Key Features

- **Interactive TikTok Live Engine:** Real-time ingestion of live comments (`!join`, `!answer`, `A/B/C/D`, `تم`), gifts, likes, shares, follows, and room viewer counters.
- **Cinematic Stage Lifecycle:** Interactive Events Stage (`WAITING`), First Join Cinematic celebration, Live Participant Grid (`REGISTRATION`), Question Countdown (`COUNTDOWN`), Radial Vector Timer (`QUESTION`), Lock & Reveal (`LOCK/RESULTS`), Smart Roulette Draw (`DRAW`), and Champion Podium (`WINNER/PODIUM`).
- **Zero Unicode Emojis:** 100% custom SVG cyber luxury visual language and procedural Canvas graphics.
- **Persistent Admin Control Dashboard:** Real-time game controls, dynamic settings persistence (saved to PostgreSQL/disk), live chat & activity feed, question bank manager (CRUD, CSV/JSON Import & Export), and simulation suite.
- **Clean Broadcast Overlay:** Dedicated zero-admin transparent broadcast screen (`/broadcast`) for OBS Studio and TikTok Live Studio.
- **PWA Ready:** Installable directly from mobile and desktop browsers with offline service worker caching.
- **Enterprise Security:** PBKDF2 password hashing, cryptographic session tokens, CSRF protection, Path Traversal defense, and strict XSS sanitization.

---

## 🛠️ Tech Stack & Architecture

- **Backend:** Node.js (v20+ / v22+), Native HTTP Server, Server-Sent Events (SSE), EventBus pipeline.
- **Database:** PostgreSQL (primary via `pg` connection pool) with automatic schema migrations + Resilient In-Memory/JSON disk fallback.
- **Frontend:** Vanilla JavaScript (ES Modules), Custom Game State reactive store, GPU-accelerated Canvas particle engine, Web Audio API procedural synthesizer.
- **Protocol:** Server-Sent Events (`/api/events`) for sub-50ms real-time latency.

---

## 📦 Getting Started Locally

### 1. Prerequisites
- **Node.js**: Version 20.6+ or 22+
- **NPM**: Version 10+

### 2. Installation
```bash
git clone https://github.com/your-username/bye-quiz-live.git
cd bye-quiz-live
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and set your TikTok channel username:
```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=production
PORT=3000
TIKTOK_USERNAME=.capuscom
DATABASE_URL=
SESSION_SECRET=your_random_64_character_hex_secret
ADMIN_PASSWORD_HASH=
ENABLE_SIMULATOR=false
```

### 4. Running the Server
```bash
npm start
```
The server will boot on `http://localhost:3000`.

### 5. Accessing Interfaces
- **📱 Vertical Mobile Game Screen:** [http://localhost:3000/](http://localhost:3000/)
- **📡 Clean OBS Broadcast Overlay:** [http://localhost:3000/broadcast](http://localhost:3000/broadcast)
- **🎮 Admin Control Dashboard:** [http://localhost:3000/admin](http://localhost:3000/admin) *(Or click the "BYE QUIZ" brand logo 3 times on the game overlay)*

---

## 🧪 Running Test Suites

Run the complete 257-test production verification suite:
```bash
npm test
```
- `test_production_phase6.mjs`: 224 automated test cases (50 complete round lifecycles, state machine transitions, draw pool algorithms).
- `test_production_integration.mjs`: 33 security, authentication, RBAC, CSRF, XSS, and server-authoritative pipeline audits.

---

## ☁️ Deployment Guide (Railway)

BYE QUIZ LIVE is optimized to run as a **single lightweight service** on Railway.

### Railway Configuration
1. **Service Type:** Web Service (Node.js).
2. **Root Directory:** `/` (Project root).
3. **Build Command:** `npm run build` *(Zero-step build required for ES Modules)*.
4. **Start Command:** `node server.js`
5. **Health Check Path:** `/api/health`
6. **Port:** `$PORT` (Automatically injected by Railway).

### Environment Variables on Railway
| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Optional | `production` | Application environment mode |
| `PORT` | Auto | `3000` | Dynamic port assigned by Railway |
| `TIKTOK_USERNAME` | Required | `your_handle` | TikTok host handle to connect to live stream |
| `DATABASE_URL` | Optional | `Empty` | PostgreSQL connection URL (auto-provided if PostgreSQL plugin is added) |
| `SESSION_SECRET` | Optional | `Random Hex` | 64-character secret for auth sessions |
| `ENABLE_SIMULATOR`| Optional | `false` | Enable/disable event simulation in production |

> **Note on Database:** If you do not attach a PostgreSQL database on Railway, the engine automatically runs in **Resilient Fallback Mode** with file persistence, requiring zero external database configuration.

---

## 📂 Project Directory Structure

```text
tiktok-live-game/
├── .env.example                       # Reference environment variables
├── .gitignore                         # Git exclusion rules
├── README.md                          # Project documentation and deployment guide
├── PROJECT_ARCHITECTURE.md            # In-depth architectural blueprint and data flow
├── package.json                       # Dependencies and run scripts
├── server.js                          # Native HTTP/SSE server & security routing
├── data/
│   ├── questionSets.json              # Themed category bundles
│   └── questions.json                 # Question bank (96 curated questions)
├── lib/
│   ├── auth.js                        # Authentication, PBKDF2 hashing, CSRF
│   ├── commandParser.js               # Chat commands parser (!join, !answer, etc.)
│   ├── database.js                    # Persistence layer (PostgreSQL + Fallback)
│   ├── eventBus.js                    # Central server event pipeline
│   ├── giftEngine.js                  # Gift rules & score rewards
│   ├── logger.js                      # Structured logging and security audit
│   ├── security.js                    # XSS sanitization & Path Traversal defense
│   ├── serverGameState.js             # Server-authoritative game state machine
│   └── tiktokConnector.js             # TikTok LIVE connection manager
├── migrations/
│   └── 001_initial_schema.sql         # PostgreSQL production database schema
└── public/
    ├── admin.html                     # Admin control dashboard
    ├── broadcast.html                 # Clean OBS broadcast screen
    ├── index.html                     # 9:16 mobile game screen
    ├── manifest.webmanifest           # PWA manifest
    ├── service-worker.js              # PWA service worker
    ├── css/style.css                  # Cyber luxury design system
    ├── icons/                         # SVG PWA vector icons
    └── js/
        ├── audio.js                   # Web Audio synthesizer
        ├── game.js                    # Frontend bootstrap
        └── engine/                    # 21 modular frontend client engines
```

---

## 🛡️ License & Credits

Proprietary Interactive Game Show Platform developed for BYE QUIZ LIVE.
All rights reserved.
