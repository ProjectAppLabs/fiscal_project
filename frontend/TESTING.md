# Frontend Testing Guide

This guide covers the **unit testing** strategy, tools, and commands for the frontend project.
For E2E tests, see [`e2e/README.md`](./e2e/README.md).

---

## Table of Contents

1. [Testing Tools](#testing-tools)
2. [Test Structure](#test-structure)
3. [Unit Tests](#unit-tests)
4. [E2E Tests](#e2e-tests)
5. [Code Coverage](#code-coverage)
6. [Available Commands](#available-commands)
7. [Best Practices](#best-practices)

---

## Testing Tools

### Jest + Testing Library
- **Purpose:** Unit and integration tests for components, stores, hooks, and services
- **Framework:** Jest with React Testing Library
- **Configuration:** `jest.config.cjs`, `jest.setup.ts`

### Playwright
- **Purpose:** End-to-End (E2E) tests — see [`e2e/README.md`](./e2e/README.md)
- **Configuration:** `playwright.config.ts`
- **Projects:** Desktop Chrome, Mobile Chrome (Pixel 5), Tablet (iPad Mini / Chromium)

---

## Test Structure

Unit tests live alongside source files inside `__tests__/` subdirectories:

```
frontend/
├── app/
│   ├── __tests__/                 # Home redirect + providers
│   ├── sign-in/__tests__/
│   ├── forgot-password/__tests__/
│   └── dashboard/__tests__/
├── components/
│   ├── brand/__tests__/
│   └── layout/__tests__/
├── lib/
│   ├── __tests__/                 # Constants + renderWithIntl helper
│   ├── hooks/__tests__/
│   ├── i18n/__tests__/
│   ├── services/__tests__/
│   └── stores/__tests__/
└── e2e/                           # Playwright E2E tests → see e2e/README.md
```

---

## Unit Tests

### Stores (Zustand)

Store tests verify application state logic:

**Example: Locale Store**
```typescript
// lib/stores/__tests__/localeStore.test.ts
import { act, renderHook } from '@testing-library/react';
import Cookies from 'js-cookie';
import { useLocaleStore } from '../localeStore';

it('writes the chosen locale to the next-intl cookie', () => {
  const { result } = renderHook(() => useLocaleStore());
  act(() => result.current.setLocale('en'));
  expect(Cookies.get('NEXT_LOCALE')).toBe('en');
});
```

**Store Coverage:**
- ✅ `authStore.test.ts` - Authentication state (sign-in, sign-out, token handling, passcode reset)
- ✅ `localeStore.test.ts` - Locale selection and the `NEXT_LOCALE` cookie
- ✅ `consoleStore.test.ts` - Console summary, document list (filters, pages) and document detail

### Components and pages

Components that use `useTranslations` must be rendered inside `NextIntlClientProvider`.
Use the shared helper (Spanish by default, `{ locale: 'en' }` for English):

```typescript
import { renderWithIntl } from '@/lib/__tests__/intl';

it('shows the empty state while there are no documents', () => {
  renderWithIntl(<DashboardPage />);
  expect(screen.getByTestId('dashboard-empty-state')).toHaveTextContent('Todavía no hay documentos');
});
```

**Coverage:**
- ✅ `app/__tests__/page.test.tsx` - Home redirect (dashboard or sign-in)
- ✅ `app/__tests__/providers.test.tsx` - Providers and auth restore
- ✅ `app/sign-in/__tests__/page.test.tsx` - Sign-in form, errors, reCAPTCHA
- ✅ `app/forgot-password/__tests__/page.test.tsx` - Passcode flow
- ✅ `app/dashboard/__tests__/page.test.tsx` - Dashboard counters, queue, latest rejection, empty and error states
- ✅ `app/documents/__tests__/page.test.tsx` - Document list, filters, pagination, empty and error states
- ✅ `app/documents/[documentId]/__tests__/page.test.tsx` - Document detail, DIAN errors, artifacts, history, not found
- ✅ `FiscalLogo.test.tsx` - Wordmark
- ✅ `layout.test.tsx` / `LocaleSwitcher.test.tsx` - Header, footer, locale switch

### Hooks, Services, and i18n

- ✅ `useRequireAuth.test.ts` - Auth guard hook
- ✅ `http.test.ts` / `tokens.test.ts` / `errors.test.ts` - API client, token helpers, error messages
- ✅ `console.test.ts` - Console API calls, pagination links, DIAN error text
- ✅ `format.test.ts` - Dates in Colombia time, byte sizes, short hashes
- ✅ `config.test.ts` - i18n config
- ✅ `constants.test.ts` - Routes and API endpoints

---

## E2E Tests

E2E tests are maintained in `e2e/` and documented separately.

**→ See [`e2e/README.md`](./e2e/README.md)** for structure, commands, Flow Coverage system, helpers, and flow definitions.

Quick commands:

```bash
npm run e2e               # Run all E2E tests
npm run test:e2e:ui       # Interactive Playwright UI
npm run test:e2e:debug    # Debug mode
```

---

## Code Coverage

### Coverage Configuration

```javascript
// jest.config.cjs
collectCoverageFrom: [
  'app/**/*.{ts,tsx}',
  'components/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
  '!**/*.d.ts',
  '!**/node_modules/**',
  '!**/__tests__/**',
  '!**/e2e/**',
  '!app/layout.tsx',
  '!app/globals.css',
],
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50,
  },
},
coverageReporters: ['text-summary', 'text', 'lcov', 'html', 'json-summary'],
```

### Coverage Reports

- **Terminal** - `text-summary` and `text` reporters
- **LCOV** - For CI/CD integration
- **HTML** - Visual report at `coverage/lcov-report/index.html`
- **JSON summary** - `coverage/coverage-summary.json`

---

## Available Commands

### Unit Tests

```bash
npm run test              # Run all unit tests
npm run test:watch        # Watch mode (development)
npm run test:ci           # CI mode (no interaction)
npm run test:coverage     # Generate coverage report
```

### All Tests

```bash
npm run test:all          # Unit coverage + E2E
```

### Global Test Runners (Backend + Frontend)

To run all suites (backend pytest + frontend unit + E2E) from the repo root:

```bash
# Sequential (default)
python3 scripts/run-tests-all-suites.py

# Parallel mode
python3 scripts/run-tests-all-suites.py --parallel
```

---

## Best Practices

1. **Render translated components with `renderWithIntl`**
   ```typescript
   import { renderWithIntl } from '@/lib/__tests__/intl';
   ```

2. **Mock external dependencies**
   ```typescript
   jest.mock('@/lib/services/http');
   ```

3. **Clean state between tests**
   ```typescript
   beforeEach(() => {
     useLocaleStore.setState({ locale: 'es' });
   });
   ```

4. **Use `waitFor` for async operations**
   ```typescript
   await waitFor(() => {
     expect(result.current.loading).toBe(false);
   });
   ```

---

## Recommended Workflow

### During Development

```bash
npm run test:watch        # Watch mode
```

### Before Commit

```bash
npm run test              # All unit tests
npm run test:coverage     # Verify coverage
```

### Before Release

```bash
npm run test:all          # Unit + E2E
npm run test:ci           # CI mode verification
```

---

## Debugging

```bash
# With VSCode: add breakpoint, then run
node --inspect-brk node_modules/.bin/jest --runInBand

# Specific test file
npm run test -- FiscalLogo.test.tsx

# Verbose output
npm run test -- --verbose
```

---

## Quality Metrics

### Coverage Goals

- **Lines:** ≥ 50%
- **Functions:** ≥ 50%
- **Branches:** ≥ 50%
- **Statements:** ≥ 50%

---

## Maintenance

### Update Messages

When a visible string changes, edit both `messages/es.json` and `messages/en.json`; the
typecheck fails on keys missing from `es.json` (see `global.d.ts`).

### Add New Tests

1. Create file in corresponding `__tests__/` folder
2. Import `renderWithIntl` when the component is translated
3. Write test cases covering happy path, edge cases, and error conditions
4. Run and verify

---

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [E2E Tests Guide](./e2e/README.md)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## Contributing

When adding new features:

1. ✅ Write unit tests for components and stores
2. ✅ Add E2E tests for user flows (see [`e2e/README.md`](./e2e/README.md))
3. ✅ Maintain coverage above threshold (50%)
4. ✅ Update this documentation if necessary
5. ✅ Verify all tests pass before PR

---

**Last updated:** February 2026
