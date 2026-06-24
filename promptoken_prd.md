# Promptoken — Product Requirements Document

**Versión:** 0.1 (Zero Cup Submission)
**Fecha:** Junio 2026
**Autor:** Brayan C. Cruz

---

## Resumen Ejecutivo

Promptoken es un protocolo de propiedad intelectual para prompts de IA, construido sobre 0G Network. Permite a los creadores de prompts monetizar su trabajo sin revelarlo, usando 0G Storage para almacenar el prompt encriptado, 0G Chain para anclar pruebas de autoría, y 0G Compute (TEE) para ejecutarlo de forma verificable. Los compradores reciben outputs, no el prompt.

El problema que resuelve: hoy no existe forma de probar autoría de un prompt, monetizarlo sin perder el secreto, ni garantizar resiliencia si el creador desaparece o lo modifica.

---

## Problema

Los prompts de producción (especialmente system prompts de agentes) representan cientos de horas de trabajo y son la ventaja competitiva real de muchos productos de IA. Sin embargo:

- No existe prueba de autoría verificable — el "dueño" de un prompt es quien lo tiene en su archivo `.env`
- Monetizarlos hoy implica venderlos en texto plano (PromptBase), destruyendo el secreto para siempre
- Las empresas que inyectan prompts en agentes de producción tienen una dependencia crítica no controlada: si el proveedor del prompt lo modifica o desaparece, su infraestructura colapsa
- El prompt injection y jailbreak son más efectivos cuando el atacante puede razonar sobre el sistema — un prompt cuya lógica nunca sale del TEE es un objetivo fundamentalmente más difícil de atacar

---

## Usuarios Objetivo

**Creadores de prompts ("Prompt Authors")**
- Consultores de IA con lógicas especializadas (legal, médico, financiero)
- Agencias con prompts de alta conversión
- Investigadores con cadenas de razonamiento originales
- Devs independientes que han engineereado agentes especializados

**Consumidores de prompts ("Prompt Consumers")**
- Fintechs y empresas que quieren inyectar lógica especializada en sus agentes sin revelarla a sus propios clientes
- Plataformas educativas, de compliance, o análisis sectorial
- Startups que quieren "comprar" una ventaja competitiva en forma de agente listo para integrar

---

## Propuesta de Valor Central

> **"Monetiza tu prompt sin mostrarlo. Úsalo sin perderlo."**

Promptoken es el primer protocolo donde el IP de un prompt puede circular como activo económico, manteniendo el secreto técnico intacto y la autoría verificada en cadena.

---

## Modelo de Monetización (3 Tiers)

| Tier | Qué recibe el comprador | Precio sugerido | Caso de uso |
|------|------------------------|-----------------|-------------|
| **Pay-per-call** | El output de ejecutar el prompt vía TEE | Fracción de centavo por llamada | Integración en producción, alto volumen |
| **Licencia de versión fija** | Acceso exclusivo a ejecutar `prompt_vX.Y` por tiempo definido | Suscripción mensual | Empresas que necesitan SLA y previsibilidad |
| **Compra de texto plano** | El prompt completo en texto claro, ownership permanente | Pago único alto | Quien quiere el IP para fork, customización o uso interno irrestricto |

El autor decide qué tiers habilita por prompt. Puede nunca habilitar el Tier 3.

---

## Arquitectura del Sistema (Alto Nivel)

### Componentes principales

```
[Prompt Author] ──→ [Promptoken App]
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
    [0G Storage]    [0G Chain]    [0G Compute / TEE]
    Prompt encriptado  Registro de    Ejecución segura
    + versiones        autoría +      sin exponer
    inmutables         licencias      el prompt
```

### Flujo 1: Registro de un prompt (Autor)

1. El autor conecta su wallet en el frontend (Next.js)
2. Selecciona o escribe el prompt a registrar
3. El frontend encripta el prompt client-side con la clave del wallet del autor
4. El prompt encriptado se sube a **0G Storage** → se obtiene un `storage_hash`
5. El frontend genera un hash del texto plano del prompt (`keccak256`)
6. Se publica un tx en **0G Chain** con: `{ author_address, storage_hash, prompt_hash, timestamp, metadata }` → esto es la **prueba de autoría**
7. El autor configura los tiers disponibles (pay-per-call, licencia, texto plano) y precios
8. El smart contract en 0G Chain registra el prompt como activo disponible

### Flujo 2: Ejecución pay-per-call (Consumidor)

1. El consumidor llama a la API de Promptoken con: `{ prompt_id, version, user_message, payment_tx }`
2. Next.js API route handler valida el pago onchain
3. Next.js API route handler recupera el prompt encriptado desde **0G Storage**
4. El prompt se desencripta dentro del **0G Compute TEE** — el texto plano nunca sale del entorno seguro
5. El TEE ejecuta el prompt + `user_message` contra el LLM configurado
6. El TEE devuelve el output al consumidor + registra el evento de ejecución en **0G Chain** (DA layer)
7. El pago se distribuye automáticamente al autor via smart contract

### Flujo 3: Compra de texto plano (Consumidor, Tier 3)

1. El consumidor paga el precio del Tier 3 al smart contract
2. El smart contract verifica el pago y emite un evento onchain: `{ buyer_address, prompt_id, version, timestamp }`
3. Next.js API route handler desencripta el prompt y lo entrega en una sesión única y cifrada end-to-end al comprador
4. El evento queda registrado permanentemente en 0G Chain — el contrato puede incluir cláusulas de no-redistribución ejecutables

### Flujo 4: Gestión de versiones

- Cada update del prompt crea una nueva versión (`v1`, `v2`, ...) con su propio `storage_hash` en 0G Storage
- Los hashes son inmutables — una versión publicada no puede ser alterada retroactivamente
- Los consumidores con licencia hacen **pin** a una versión específica: `prompt_v2.3` siempre ejecuta exactamente ese hash, incluso si el autor publica `v3`
- Si el autor quiere deprecar una versión, puede anunciar el fin de soporte onchain, pero no puede borrar el hash de Storage

### Flujo 5: Resiliencia ante desaparición del autor

- Si el autor deja de responder o desaparece, los consumidores con licencias activas pueden invocar un mecanismo de gobernanza onchain
- Con quorum de licenciatarios activos, se puede transferir la custodia del prompt a un multisig — sin revelar el contenido, solo transfiriendo quién controla el acceso al TEE
- El contrato puede definir un SLA mínimo de disponibilidad; si no se cumple, activa refund automático

---

## Smart Contracts (Lógica de Negocio)

### `PromptRegistry.sol`
- `registerPrompt(storageHash, promptHash, metadata, tiers)` → crea activo
- `publishVersion(promptId, newStorageHash)` → nueva versión inmutable
- `setTierConfig(promptId, tier, price, enabled)` → gestión de precios

### `PromptLicense.sol`
- `purchaseCallLicense(promptId, version)` → pago por llamadas con contador
- `purchaseFixedLicense(promptId, version, duration)` → suscripción por tiempo
- `purchasePlaintext(promptId, version)` → compra definitiva, emite evento auditado
- `claimRefund(promptId, licenseId)` → si el autor incumple SLA

### `PromptGovernance.sol`
- `proposeTransfer(promptId, newCustodian)` → iniciado por licenciatarios
- `voteTransfer(proposalId)` → voto por wallet con licencia activa
- `executeTransfer(proposalId)` → si se alcanza quorum, transfiere custodia

---

## API Backend (Next.js API Routes)

### Endpoints principales

Los endpoints se implementan como Next.js Route Handlers (`app/api/`):

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/prompts/register` | Registra prompt encriptado en 0G Storage y 0G Chain |
| `GET` | `/api/prompts/[id]` | Metadata pública del prompt (sin contenido) |
| `POST` | `/api/prompts/[id]/execute` | Ejecuta el prompt en TEE, devuelve output |
| `GET` | `/api/prompts/[id]/versions` | Lista de versiones con hashes verificables |
| `POST` | `/api/prompts/[id]/purchase` | Inicia compra de texto plano (Tier 3) |
| `GET` | `/api/executions/[prompt_id]` | Historial de ejecuciones onchain del prompt |

### Autenticación
- Wallet-based auth via signed message (SIWE — Sign In With Ethereum)
- Sesión HTTP gestionada con next-auth (o iron-session) para llamadas API subsiguientes

---

## Frontend (Next.js)

### Vistas principales

**1. Marketplace**
- Grid de prompts disponibles con metadata: categoría, precio/call, número de ejecuciones, rating
- Filtros por categoría (legal, finanzas, educación, agentes, etc.), tier disponible, precio
- Vista de detalle del prompt: descripción, historial de versiones, ejemplos de output (si el autor los provee), precio por tier

**2. Dashboard del Autor**
- Lista de prompts registrados con métricas: llamadas totales, ingresos acumulados, licencias activas
- Panel de gestión de versiones: publicar nueva versión, ver hashes en 0G Storage
- Configuración de tiers y precios por prompt
- Historial de ventas de texto plano (auditado onchain)

**3. Dashboard del Consumidor**
- Prompts con licencia activa, contador de llamadas restantes, expiración de suscripciones
- Historial de ejecuciones: input, output, timestamp, hash de ejecución en 0G Chain
- Integración: código de ejemplo (TypeScript/Python) para llamar a la API desde su stack

**4. Registro de prompt**
- Wizard de 4 pasos: conectar wallet → subir/escribir prompt → configurar tiers y precios → confirmar tx onchain
- Preview de cómo se verá el prompt en el marketplace

---

## Casos de Uso Prioritarios (MVP)

Para el Zero Cup, el MVP debe demostrar al menos los flujos 1 y 2 de manera funcional.

### MVP Scope
- ✅ Registro de prompt con encriptación client-side y upload a 0G Storage
- ✅ Registro de prueba de autoría en 0G Chain (tx con hash)
- ✅ Ejecución pay-per-call a través de Next.js API route handler (TEE simplificado para demo: route handler actúa como custodio del secret en memoria)
- ✅ Marketplace con listing básico de prompts disponibles
- ✅ Verificación de autoría: cualquiera puede consultar el hash del prompt en 0G Chain y verificar que coincide

### Post-MVP (fuera del scope del hackathon)
- Integración nativa con 0G Compute TEE real
- Sistema de versiones con gobernanza onchain
- Mecanismo de SLA y refund automático
- Rating y reviews de prompts
- SDK cliente para integración en apps externas

---

## Diferenciación vs. Competencia

| | PromptBase | LICEN | Promptoken |
|--|-----------|-------|------------|
| **Objeto protegido** | Prompts (vendidos en texto plano) | Datasets de ML | Prompts (secreto preservado) |
| **El comprador recibe** | El prompt en claro | El modelo entrenado | Solo el output |
| **Prueba de autoría** | Ninguna | Hash en cadena | Hash + timestamp en 0G Chain |
| **Resiliencia** | Cero (plataforma custodial) | No aborda | Versionado inmutable + gobernanza |
| **Modelo de ingreso** | Venta única | Royalties por entrenamiento | 3 tiers: call / suscripción / compra |
| **Protección contra copia** | Ninguna post-compra | TEE para entrenamiento | Prompt nunca sale del TEE |
| **Seguridad vs. jailbreak** | No aplica | No aplica | Caja negra — prompt inaccesible |

---

## Stack Técnico Sugerido

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript, TailwindCSS |
| Backend | Next.js API Routes (Route Handlers) |
| Blockchain | 0G Chain (EVM-compatible), ethers.js / wagmi |
| Storage | 0G Storage SDK |
| Compute | 0G Compute (TEE) — Next.js API route handlers actúan como proxy para demo |
| Smart Contracts | Solidity, Hardhat |
| Auth | SIWE (Sign In With Ethereum) |
| Infra | Docker + Dokploy |

> **Nota:** Todo en Next.js para MVP — API routes embebidas, sin backend separado.

---

## Métricas de Éxito (para el hackathon)

- [ ] Un prompt registrado con prueba de autoría verificable en 0G Chain testnet
- [ ] Un prompt ejecutado correctamente via pay-per-call sin exponer el texto al consumidor
- [ ] Demo en vivo: el juez puede subir un prompt, registrarlo, y un "consumidor" puede llamarlo y ver el output — sin ver el prompt

---

## Pitch Central

> *"El código tiene licencias open source. Los modelos tienen pesos. Pero los prompts — el conocimiento más valioso del stack de IA — no tienen propiedad verificable. Los construimos, los perdemos. Promptoken cambia eso: autoría onchain, ejecución en TEE, monetización sin exposición. Todo sobre 0G."*

