# Promptoken — Frontend Handoff

> **Generado:** 2026-06-24
> **Contexto:** Este documento es para que cualquier agente retome el frontend de Promptoken sin perder tiempo. El proyecto se desarrolló con SDD (Spec-Driven Development) — fases enteras estan documentadas en Engram bajo `sdd/promptoken-frontend/*`.

---

## Estado Actual

| Componente | Estado | Notas |
|-----------|--------|-------|
| Smart Contracts | ✅ Completo | 3 contratos deployados en 0G Galileo testnet |
| Frontend Foundation (Phase 1) | ✅ Completo | lib/, providers, wallet connect |
| API Routes (Phase 2) | ✅ Completo | SIWE auth, prompts CRUD, execute, purchase |
| Pages (Phase 3) | ✅ Completo | Marketplace, Detail, Register Wizard, Dashboards |
| Polish (Phase 4) | ✅ Completo | Loading/Error states, README |
| **Hydration bugs** | 🔴 **Pendiente** | Next.js 16 + wagmi SSR mismatch en NavBar/page |
| **next-auth session** | 🔴 **Pendiente** | `GET /api/auth/session` returns 500 en dev |

---

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.9 |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Wallet | wagmi + RainbowKit | wagmi 2.19, rainbowkit 2.2 |
| Blockchain | viem | 2.53 |
| Auth | next-auth + SIWE | v5 beta.31 |
| Storage | @0glabs/0g-ts-sdk | 0.3.3 |

---

## Issues Conocidos (sin resolver)

### 1. Hydration Mismatch en `<html>` className
**Symptoms:** Error en consola del browser, React regenera el tree en cliente
**Root Cause:** `next/font` genera class names no-deterministas entre SSR y client bundle con Turbopack
**Fix applied:** `suppressHydrationWarning` en `<html lang="en">` (ya está)
**Status:** Debería estar resuelto con ese fix, verificar en Windows

### 2. Hydration Mismatch en page content (wagmi hooks)
**Symptoms:** Error apuntando a `page.tsx:118` o `NavBar`
**Root Cause:** `useAccount()` de wagmi retorna `{ isConnected: false }` en SSR pero `{ isConnected: true }` en cliente si el usuario ya conectó la wallet. Las ramas condicionales (`{isConnected && ...}`) difieren entre server y client.
**Fix applied:** mounted pattern (`useState + useEffect`) en `NavBar` y `suppressHydrationWarning` en html
**Pendiente:** Si el error persiste, aplicar mounted pattern también en `page.tsx` alrededor del `{!isConnected && <WalletConnect />}` y en cualquier componente que use `useAccount` condicionalmente

### 3. next-auth session endpoint retorna 500
**Symptoms:** 
```
GET /api/auth/session 500
TypeError: components.ComponentMod.handler is not a function
```
**Root Cause:** Posible incompatibilidad entre next-auth v5 beta.31 y Next.js 16 Turbopack en desarrollo. El route handler en `app/api/auth/[...nextauth]/route.ts` exporta `GET` y `POST` desde `handlers` de next-auth.
**Attempted fixes:**
- `runtime: "nodejs"` en route handler
- Export directo: `export const { GET, POST } = handlers`
**Pendiente:** Investigar si next-auth v5 beta requiere configuración adicional para Turbopack, o si hay que actualizar a una versión más reciente. Alternativa: switchear a `iron-session` para SIWE (más simple, sin dependencia pesada).

### 4. ClientFetchError: Unexpected token '<'
**Symptoms:** 
```
ClientFetchError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```
**Root Cause:** Es el mismo issue #3 — el session endpoint retorna HTML (página de error 500) en vez de JSON, y next-auth en cliente espera JSON.
**Fix:** Resolver issue #3.

### 5. Encryption key mismatch
**Symptoms:** El prompt se encripta client-side con la wallet del usuario, pero el server intenta desencriptar con `PRIVATE_KEY`
**Root Cause:** El patrón "onlyOwner for MVP" requiere que el server sea quien encripte/desencripte, o compartir la key de encriptación.
**Para MVP:** Es aceptable (el server actúa como custodio). Para producción implementar cifrado real con TEE.
**Nota:** La API route `/api/prompts/[id]/execute` ya tiene mock LLM response cuando falla desencriptación.

### 6. 0G SDK y Node.js `fs`
**Root Cause:** `@0glabs/0g-ts-sdk` usa módulos nativos de Node.js (`fs`, `path`).
**Fix:** 
- `runtime: "nodejs"` en todas las API routes que usan 0G SDK
- `serverExternalPackages: ["@0glabs/0g-ts-sdk"]` en `next.config.ts`
- Verificar que estas rutas NO usen `runtime: "edge"`

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
NEXTAUTH_SECRET=<generar random, ~openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
PRIVATE_KEY=<server wallet para executeCall>
OPENAI_API_KEY=<opcional, para LLM real>
```

---

## SDD Artifacts en Engram

Para el próximo agente: buscar en Engram con `mem_search(query: "sdd/promptoken-frontend/*", project: "promptoken")`

| Artifact | Topic Key | Contenido |
|----------|-----------|-----------|
| Explore | `sdd/promptoken-frontend/explore` | Investigación de stack, dependencias, risks |
| Proposal | `sdd/promptoken-frontend/proposal` | Scope, arquitectura, ADRs |
| Spec | `sdd/promptoken-frontend/spec` | 10 requerimientos, 14 escenarios |
| Design | `sdd/promptoken-frontend/design` | Estructura de archivos, ADRs, diagramas |
| Tasks | `sdd/promptoken-frontend/tasks` | 18 tareas en 4 fases |
| Progress | `sdd/promptoken-frontend/apply-progress` | Estado de implementación |

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

1. **Fix next-auth session 500** — resolver issue #3 (prioridad máxima, bloquea cualquier flujo de login)
2. **Corregir hydration restante** — si persiste, aplicar mounted pattern en page.tsx
3. **Probar flujo completo Register → Execute** en localhost con testnet
4. **Agregar PRIVATE_KEY al .env.local** para que funcione executeCall
5. **Probar en Windows** — verificar que no haya issues con paths (0G SDK usa `fs`)
6. **Mejorar la iteración de prompts en marketplace** — actualmente escanea IDs 1-100 on-chain, ineficiente para producción. Ideal: event indexer o subgraph.
7. **Agregar pruebas E2E** con Playwright para el flujo core
8. **Deploy a Vercel** (con `runtime: "nodejs"` configurado)
