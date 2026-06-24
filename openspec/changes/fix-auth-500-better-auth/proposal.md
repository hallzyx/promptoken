# Proposal: Migrar autenticación a Better Auth + SIWE

**Change ID:** fix-auth-500-better-auth
**Type:** Bugfix + Architecture
**Status:** Proposed

## Problem

La autenticación del frontend está rota. `GET /api/auth/session` retorna 500 con error:
```
TypeError: components.ComponentMod.handler is not a function
```

**Root Cause:** `next-auth@5.0.0-beta.31` es incompatible con Next.js 16 + Turbopack. El export de route handlers que usa `next-auth` no es procesado correctamente por el module bundler de Turbopack en Next.js 16.

**Contexto adicional:** Auth.js (el proyecto detrás de `next-auth`) fue oficialmente mergeado a Better Auth en Septiembre 2025 ([issue #13251](https://github.com/nextauthjs/next-auth/issues/13251)). La beta v5 está efectivamente en modo mantenimiento sin nuevas fixes para compatibilidad con Next.js 16.

## Proposed Solution

**Migrar de `next-auth` v5 beta a `better-auth` con plugin SIWE nativo.**

Better Auth ofrece:
- Plugin SIWE (Sign-In with Ethereum) nativo — soporte first-class para wallet auth
- Compatibilidad garantizada con Next.js 16 + Turbopack
- Mejor performance (menos bundle size, server-first design)
- Mantenimiento activo y comunidad creciente
- Migración documentada desde Auth.js

## Capabilities Affected

- **auth** (nueva): Autenticación wallet-based con SIWE via Better Auth

## Scope

### In Scope
- Instalar `better-auth` y eliminar `next-auth`
- Configurar Better Auth con plugin SIWE usando `viem` para verificación de firmas
- Crear `lib/auth.ts` con la configuración de Better Auth
- Actualizar route handler en `app/api/auth/[...all]/route.ts`
- Actualizar `components/providers.tsx` para usar Better Auth session
- Configurar base de datos MySQL para sesiones
- Migrar tipos de TypeScript
- Actualizar `getServerSession()` calls en API routes existentes

### Out of Scope
- Migrar a proxy.ts (Next.js 16 middleware — no necesario para MVP)
- ENS lookup (nice-to-have post-MVP)
- Email verification flows
- Two-factor auth

## Success Criteria

1. `GET /api/auth/session` retorna 200 con sesión vacía cuando no hay usuario autenticado
2. Usuario puede conectar wallet via RainbowKit y autenticarse con SIWE
3. API routes protegidas pueden leer `walletAddress` de la sesión
4. Sign-out funciona correctamente
5. No hay errores de hydration en el frontend
