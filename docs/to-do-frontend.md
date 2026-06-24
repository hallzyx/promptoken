# Promptoken — Frontend Handoff

> **Actualizado:** 2026-06-24 (post Better Auth migration)
> **Contexto:** Este documento es para que cualquier agente retome el frontend de Promptoken sin perder tiempo. El proyecto se desarrolló con SDD (Spec-Driven Development). Artifacts en `openspec/changes/` y en Engram bajo `sdd/promptoken-frontend/*`.

---

## Estado Actual

| Componente | Estado | Notas |
|-----------|--------|-------|
| Smart Contracts | ✅ Completo | 3 contratos deployados en 0G Galileo testnet |
| Frontend Foundation (Phase 1) | ✅ Completo | lib/, providers, wallet connect |
| API Routes (Phase 2) | ✅ Completo | Better Auth SIWE, prompts CRUD, execute, purchase |
| Pages (Phase 3) | ✅ Completo | Marketplace, Detail, Register Wizard, Dashboards |
| Polish (Phase 4) | ✅ Completo | Loading/Error states, README |
| **Auth (Better Auth)** | ✅ **Migrado** | next-auth v5 → better-auth 1.6.20 con plugin SIWE nativo |
| **Hydration bugs** | ✅ **Resuelto** | 0 errores en todas las páginas (verificado con Playwright) |

---

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.9 |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Wallet | wagmi + RainbowKit | wagmi 2.19, rainbowkit 2.2 |
| Blockchain | viem | 2.53 |
| Auth | Better Auth + SIWE plugin | better-auth 1.6.20 |
| Database | MariaDB (MySQL) | 10.4.27 |
| Storage | @0glabs/0g-ts-sdk | 0.3.3 |

---

## Issues Conocidos (sin resolver)

### 1. Encryption key mismatch (MVP limitation)

**Symptoms:** El prompt se encripta client-side con wallet del usuario, server desencripta con `PRIVATE_KEY`
**Root Cause:** Patrón "onlyOwner for MVP" — el server es custodio del secret en memoria.
**Para MVP:** Aceptable. Para producción implementar TEE real con 0G Compute.

### 2. 0G SDK y Node.js `fs`

**Root Cause:** `@0glabs/0g-ts-sdk` usa módulos nativos de Node.js (`fs`, `path`).
**Fix:** 
- `runtime: "nodejs"` en todas las API routes que usan 0G SDK
- `serverExternalPackages: ["@0glabs/0g-ts-sdk"]` en `next.config.ts`

---

## Arquitectura del Frontend

### Rutas

| Ruta | Página | Data Source |
|------|--------|-------------|
| `/` | Marketplace | `usePublicClient()` → lectura on-chain de PromptRegistry |
| `/prompts/[id]` | Detalle + Execute | `GET /api/prompts/[id]` |
| `/register` | Wizard 4 pasos | `POST /api/prompts/register` |
| `/dashboard` | Author dashboard | `usePublicClient()` + `GET /api/prompts?author=` |
| `/dashboard/consumer` | Consumer dashboard | `usePublicClient()` + PromptLicense queries |

### API Routes

| Ruta | Método | Propósito |
|------|--------|-----------|
| `/api/auth/[...nextauth]` | GET, POST | SIWE auth con next-auth v5 |
| `/api/prompts` | GET | Listar prompts con paginación |
| `/api/prompts/[id]` | GET | Detalle de prompt + tiers |
| `/api/prompts/register` | POST | Registrar prompt (encriptado → 0G Storage → on-chain) |
| `/api/prompts/[id]/execute` | POST | Ejecutar prompt (verificar license, descifrar, LLM, tx) |
| `/api/prompts/[id]/purchase` | POST | Calcular costo de licencia |

### Providers (orden de anidamiento)
```
WagmiProvider → QueryClientProvider → RainbowKitProvider → SessionProvider
```

---

## StellarFlow Design System

Ver `/home/arroz/projects/promptoken/.design/design.md` para la guía completa.

TL;DR:
- **Background:** `#131313`
- **Primary:** `#b7c4ff` (highlights/icons)
- **Primary Container:** `#3d4fb0` (buttons)
- **Secondary:** `#ffe575` (AI badges)
- **Surface:** `#1f1f1f` (cards)
- **Borders:** `#434656`, 1px, sin sombras
- **Font:** Inter (body), JetBrains Mono (labels uppercase tracking-widest)
- **Nav:** Glass effect (`backdrop-blur-md bg-background/80`)
- **Grid bg:** `radial-gradient(#222 1px, transparent 1px) 40px`

---

## Variables de Entorno Requeridas

```env
# frontend/.env.local
NEXT_PUBLIC_L1_RPC=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_STORAGE_RPC=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_PROMPT_REGISTRY=0x1337CcF29d030005A3388839C76d9E30C73C708B
NEXT_PUBLIC_PROMPT_LICENSE=0x75CDdB80a27DA07dBE654B58d008B78872e7a7a9
NEXT_PUBLIC_PROMPT_GOVERNANCE=0xcd4f00b65729B69D757aa6fa513cdD8A6617699b
BETTER_AUTH_SECRET=<generar random>
BETTER_AUTH_URL=http://localhost:3000
DATABASE_HOST=localhost
DATABASE_PORT=33065
DATABASE_USER=root
DATABASE_PASSWORD=
DATABASE_NAME=promptoken
PRIVATE_KEY=<server wallet para on-chain txs>
# OPENAI_API_KEY=<opcional, para LLM real>
```

---

## SDD Artifacts

| Artifact | Ubicación | Contenido |
|----------|-----------|-----------|
| Auth Fix (SDD cycle) | `openspec/changes/fix-auth-500-better-auth/` | Proposal, Spec, Design, Tasks |
| Auth memory | Engram → `sdd/promptoken-frontend/fix-auth-500` | Migración next-auth → Better Auth |

---

## Quick Start

```bash
# 1. Instalar dependencias
cd frontend && npm install

# 2. Configurar .env.local (ver arriba)
cp .env.local.example .env.local

# 3. Development
npm run dev

# 4. Build
npm run build
```

---

## Próximos Pasos Recomendados

1. ~~**Fix next-auth session 500**~~ → ✅ Migrado a Better Auth + SIWE plugin
2. ~~**Verificar hydration**~~ → ✅ 0 errores en 5 páginas (Playwright)
3. **Probar flujo completo Register → Execute** en localhost con testnet (requiere wallet + firma SIWE en browser)
4. **Mejorar la iteración de prompts en marketplace** — actualmente escanea IDs 1-100 on-chain, ineficiente para producción
5. **Agregar pruebas E2E** con Playwright para el flujo core
6. **Deploy a Vercel** (con `runtime: "nodejs"` y variables de entorno configuradas)
