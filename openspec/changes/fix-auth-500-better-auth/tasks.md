# Tasks: Better Auth + SIWE Migration

**Change ID:** fix-auth-500-better-auth

## Phase 1: Dependencies & Setup

- [ ] **1.1** Install `better-auth` and `mysql2`, remove `next-auth` and `siwe` from `package.json`
- [ ] **1.2** Create `lib/auth.ts` with Better Auth configuration + SIWE plugin using viem
- [ ] **1.3** Create `lib/auth-client.ts` with typed client for frontend
- [ ] **1.4** Run `npx @better-auth/cli migrate` to create database tables
- [ ] **1.5** Update `.env.local`: add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`

## Phase 2: Route Handler & Session

- [ ] **2.1** Delete old route handler `app/api/auth/[...nextauth]/route.ts`
- [ ] **2.2** Create new route handler `app/api/auth/[...all]/route.ts` using `toNextJsHandler(auth)`
- [ ] **2.3** Create `lib/auth-utils.ts` with `getServerSession()` helper for API routes
- [ ] **2.4** Update all API routes (`/api/prompts/*`) to use new `getServerSession()`

## Phase 3: Frontend Providers

- [ ] **3.1** Delete `types/next-auth.d.ts`
- [ ] **3.2** Update `components/providers.tsx`:
  - Remove `SessionProvider` from `next-auth/react`
  - Add Better Auth session context
- [ ] **3.3** Update `components/nav-bar.tsx` to use Better Auth session
- [ ] **3.4** Update `app/layout.tsx` if needed for auth context

## Phase 4: Cleanup & Verify

- [ ] **4.1** Remove unused next-auth imports across codebase
- [ ] **4.2** Verify `GET /api/auth/ok` returns `{ status: "ok" }`
- [ ] **4.3** Test full SIWE flow: connect wallet → sign → session created → sign out
- [ ] **4.4** Verify no hydration errors in browser console
- [ ] **4.5** Run `npm run build` to verify no build errors
