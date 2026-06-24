# Design: Better Auth + SIWE Migration

**Change ID:** fix-auth-500-better-auth

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                 │
│                                                         │
│  components/providers.tsx                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │ WagmiProvider → QueryClientProvider                │  │
│  │ → RainbowKitProvider → BetterAuthSessionProvider   │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  lib/auth.ts (Better Auth config)                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │ betterAuth({                                       │  │
│  │   database: mysql2 pool,                           │  │
│  │   plugins: [siwe({ verifyMessage via viem })],     │  │
│  │   trustedOrigins: [NEXT_PUBLIC_URL]                │  │
│  │ })                                                 │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  app/api/auth/[...all]/route.ts                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ export const { GET, POST } = toNextJsHandler(auth) │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│              MySQL Database (localhost:33065)            │
│         ┌──────────┬──────────┬──────────────┐         │
│         │   user   │ session  │   account    │         │
│         └──────────┴──────────┴──────────────┘         │
└─────────────────────────────────────────────────────────┘
```

## Key Decisions

### ADR-001: Better Auth over next-auth v5

**Decision:** Replace `next-auth@5.0.0-beta.31` with `better-auth`.

**Rationale:**
- next-auth v5 beta fue mergeado a Better Auth (Sept 2025)
- Turbopack de Next.js 16 no procesa correctamente los route handlers de next-auth
- Better Auth tiene plugin SIWE nativo — no necesitamos implementar Credentials provider manualmente
- Mejor integración con TypeScript, mejor tree-shaking, menor bundle

**Alternatives considered:**
- **iron-session**: Más simple pero sin SIWE, sin CSRF protection built-in, sin plugin ecosystem
- **Fixear next-auth**: Posible con workarounds pero es patear el problema — la lib está abandonada

### ADR-002: MySQL como database adapter

**Decision:** Usar MySQL (localhost:33065, sin password) para persistencia de sesiones.

**Rationale:**
- El usuario ya tiene MySQL disponible
- Better Auth soporta `mysql2` como adapter directo (sin ORM)
- Las sesiones necesitan persistencia — cookie-only no es suficiente para SIWE state
- Schema mínimo: 3 tablas (user, session, account)

**Alternatives considered:**
- **SQLite**: Más simple pero requiere archivo local, no escala
- **Sin database**: Stateless mode no soporta todas las features de SIWE

### ADR-003: SIWE verification via viem

**Decision:** Usar `viem` (`verifyMessage`) para verificar firmas SIWE en el servidor.

**Rationale:**
- `viem` ya está en el proyecto (usado por wagmi)
- `verifyMessage` es la función estándar para verificar firmas EIP-191
- Evita dependencia extra (`ethers`)

### ADR-004: Route handler en `[...all]` catch-all

**Decision:** Usar `app/api/auth/[...all]/route.ts` en lugar de `[...nextauth]`.

**Rationale:**
- Better Auth usa `[...all]` por convención
- `toNextJsHandler(auth)` devuelve `{ GET, POST }` — export directo compatible con Turbopack
- Sin el problema de `ComponentMod.handler is not a function`

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Reemplazar `next-auth` + `siwe` por `better-auth` |
| `lib/auth.ts` | Rewrite | Configuración Better Auth + SIWE plugin |
| `app/api/auth/[...nextauth]/route.ts` | Delete | Eliminar viejo handler |
| `app/api/auth/[...all]/route.ts` | Create | Nuevo handler Better Auth |
| `components/providers.tsx` | Modify | SessionProvider → Better Auth context |
| `types/next-auth.d.ts` | Delete | Ya no se necesita |
| `lib/auth-client.ts` | Create | Cliente Better Auth para frontend |
| `lib/auth-utils.ts` | Create | Helpers: getSession, requireAuth |
| `.env.local` | Modify | `NEXTAUTH_SECRET` → `BETTER_AUTH_SECRET` |

## Database Schema

```sql
-- Auto-generado por Better Auth CLI (npx @better-auth/cli migrate)
-- Tablas: user, session, account, verification
```

## Migration Path

1. Instalar `better-auth` y remover `next-auth`
2. Crear nueva config en `lib/auth.ts`
3. Ejecutar migración de DB
4. Actualizar providers y route handler
5. Actualizar API routes que leen sesión
6. Probar flujo completo SIWE
7. Limpiar archivos viejos de next-auth
