# 🔧 Frontend Setup Guide — Fiscal.

## Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Environment Variables

Copy the example file and configure:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Optional - API base URL (defaults to /api which uses Next.js rewrites)
NEXT_PUBLIC_API_BASE_URL=/api

# Django backend origin (used by rewrites and media proxy)
NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost:8000
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

---

## 📁 Project Structure

```
frontend/
├── app/                      # Next.js App Router pages
│   ├── __tests__/           # Home redirect + providers tests
│   ├── sign-in/             # Sign in (email + password, reCAPTCHA when configured)
│   ├── forgot-password/     # Password reset with an emailed passcode
│   ├── dashboard/           # Protected operations console
│   ├── layout.tsx           # Root layout (next-intl provider, metadata «Fiscal.»)
│   ├── providers.tsx        # Theme + auth restore
│   └── page.tsx             # Redirects to /dashboard or /sign-in
├── components/
│   ├── brand/               # FiscalLogo (Ubuntu Bold wordmark)
│   ├── layout/              # Header, Footer, LocaleSwitcher
│   ├── staging/             # Staging phase banner and expired overlay
│   └── theme-toggle.tsx
├── messages/                # next-intl messages (es = default, en)
├── lib/
│   ├── __tests__/           # Shared test helpers (renderWithIntl)
│   ├── constants.ts         # Routes, API endpoints, cookie keys
│   ├── hooks/               # useRequireAuth, useHydrated
│   ├── i18n/                # Locale config + next-intl request config
│   ├── stores/              # authStore, localeStore, stagingBannerStore
│   └── services/            # Axios instance with refresh, tokens, staging banner
├── proxy.ts                 # Route guard and `/` redirect
└── e2e/                     # Playwright E2E tests
```

---

## 🧪 Testing

### Unit Tests
```bash
npm run test              # Run unit tests (Jest)
npm run test:watch        # Unit tests in watch mode
npm run test:ci           # Unit tests in CI mode
npm run test:coverage     # Unit tests with coverage + summary
```

### E2E Tests
```bash
npm run test:e2e          # All E2E tests
npm run e2e               # Alias for test:e2e
npm run test:e2e:ui       # Interactive UI
npm run test:e2e:headed   # With visible browser
npm run test:e2e:debug    # Debug mode
npm run e2e:desktop       # Desktop Chrome only
npm run e2e:mobile        # Mobile Chrome only
npm run e2e:tablet        # Tablet only
npm run e2e:clean         # Clear Playwright reports
```

### All Tests
```bash
npm run test:all          # Unit coverage + E2E
```

---

## 🚀 Available Scripts

```json
{
  "dev": "Start development server (Next.js)",
  "build": "Build for production",
  "start": "Start production server",
  "lint": "Run ESLint",
  "test": "Run unit tests (Jest)",
  "test:watch": "Unit tests in watch mode",
  "test:ci": "Unit tests in CI mode",
  "test:coverage": "Unit tests with coverage + summary",
  "test:e2e": "Run Playwright E2E tests",
  "test:e2e:ui": "E2E with Playwright UI",
  "test:e2e:headed": "E2E with visible browser",
  "test:e2e:debug": "E2E in debug mode",
  "e2e": "Alias for test:e2e",
  "e2e:desktop": "E2E on Desktop Chrome",
  "e2e:mobile": "E2E on Mobile Chrome",
  "e2e:tablet": "E2E on Tablet",
  "e2e:clean": "Clean Playwright reports",
  "e2e:coverage": "Clean reports then run all E2E tests",
  "test:all": "Run unit coverage + E2E"
}
```

---

## 🔐 Authentication Pages

### Sign In (`/sign-in`)
- Email/password form
- reCAPTCHA when the backend returns a site key
- Link to forgot password

### Forgot Password (`/forgot-password`)
- Step 1: Enter email → Receive 6-digit code
- Step 2: Enter code + new password → Reset complete

### Console (`/dashboard`)
- Protected with `useRequireAuth` (and by `proxy.ts` on the server)
- «Fiscal.» wordmark, «Consola de operación» and the empty documents state

### Home (`/`)
- Redirects to `/dashboard` with a session, otherwise to `/sign-in`

## 🌐 i18n

- `next-intl` without locale routing: the locale comes from the `NEXT_LOCALE` cookie (`lib/i18n/request.ts`).
- Spanish (`es`) is the default; English (`en`) is available from the header switcher.
- Messages live in `messages/es.json` and `messages/en.json`; keys are typed through `global.d.ts`.

---

## 📊 State Management (Zustand)

### Auth Store
```typescript
import { useAuthStore } from '@/lib/stores/authStore';

const {
  isAuthenticated,
  user,
  signIn,
  signOut,
  sendPasswordResetCode,
  resetPassword,
} = useAuthStore();
```

---

## 🐛 Troubleshooting

### API calls failing

Make sure both servers are running:
```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate && python manage.py runserver

# Terminal 2: Frontend
cd frontend && npm run dev
```

The backend must be running on `http://localhost:8000`; Next.js proxies `/api/*` to it.

### Port already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs -r kill -9

# Kill process on port 8000  
lsof -ti:8000 | xargs -r kill -9
```

---

## Documentation

| Guide | Scope |
|-------|-------|
| [`TESTING.md`](./TESTING.md) | Unit tests (Jest + RTL): tools, structure, coverage, commands, best practices |
| [`e2e/README.md`](./e2e/README.md) | E2E tests (Playwright): structure, commands, Flow Coverage system, flow definitions |

---

**Last Updated:** October 2026
