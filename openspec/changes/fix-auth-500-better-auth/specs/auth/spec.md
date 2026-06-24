# Spec: Autenticación Wallet-Based (SIWE) con Better Auth

**Capability:** auth
**Version:** 1.0.1

## Requirements

### REQ-AUTH-001: Auth endpoint returns valid responses

The auth API endpoints SHALL return 200 OK with valid JSON when queried, regardless of authentication state.

**Rationale:** The previous next-auth v5 implementation returns 500 due to Turbopack incompatibility. Better Auth solves this with proper Next.js 16 + Turbopack compatibility.

#### Scenario: Health endpoint returns ok

- **GIVEN** Better Auth is configured and running
- **WHEN** `GET /api/auth/ok` is called
- **THEN** response status is 200
- **AND** response body is `{ "ok": true }`

#### Scenario: Unauthenticated session returns null

- **GIVEN** no user is authenticated
- **WHEN** `GET /api/auth/get-session` is called
- **THEN** response status is 200
- **AND** response body is `null` (valid JSON, no active session)

### REQ-AUTH-002: SIWE nonce generation

The system SHALL generate a unique, cryptographically secure nonce for a given wallet address to initiate SIWE authentication.

#### Scenario: Request nonce for wallet

- **GIVEN** a user has connected their wallet via RainbowKit
- **WHEN** the client calls `authClient.siwe.nonce({ walletAddress: "0x..." })` 
- **THEN** a nonce string is returned
- **AND** the nonce is at least 32 characters
- **AND** the nonce is unique per request

### REQ-AUTH-003: SIWE signature verification and authentication

The system SHALL verify a signed SIWE message and create an authenticated session for the wallet owner.

#### Scenario: Valid SIWE signature authenticates user

- **GIVEN** a user has obtained a nonce for wallet `0xABC...`
- **AND** the user signs the SIWE message with their wallet
- **WHEN** the client calls `authClient.siwe.verify({ message, signature, walletAddress })`
- **THEN** an authenticated session is created
- **AND** the session contains the wallet address as `user.id`
- **AND** subsequent API calls can identify the user by wallet address

#### Scenario: Invalid signature is rejected

- **GIVEN** a SIWE message with an invalid or forged signature
- **WHEN** the client calls `authClient.siwe.verify()` with the invalid signature
- **THEN** authentication fails
- **AND** no session is created
- **AND** an error is returned

### REQ-AUTH-004: Session persistence across requests

The system SHALL persist the authenticated session so that subsequent API route calls can read the wallet address.

#### Scenario: Authenticated API route reads wallet address

- **GIVEN** a user has authenticated with wallet `0xABC...`
- **WHEN** the user calls a protected API route
- **THEN** `getServerSession()` returns the session with `user.id` = wallet address
- **AND** the API route can use the wallet address for authorization

### REQ-AUTH-005: Sign-out

The system SHALL allow authenticated users to sign out, destroying their session.

#### Scenario: Authenticated user signs out

- **GIVEN** a user is authenticated with wallet `0xABC...`
- **WHEN** the client calls `authClient.signOut()`
- **THEN** the session is destroyed
- **AND** subsequent `GET /api/auth/get-session` returns null
- **AND** the user is redirected to the homepage

### REQ-AUTH-006: No hydration mismatch

The authentication provider SHALL NOT cause React hydration mismatches between server and client renders.

#### Scenario: Page loads without hydration errors

- **GIVEN** the frontend is loaded in a browser
- **WHEN** the page renders (both SSR and client hydration)
- **THEN** no React hydration warnings appear in the browser console
- **AND** the wallet connection state is consistent between server and client
