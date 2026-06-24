# Proposal: Fix Register Flow — Storage Upload + On-chain Tx

**Change ID:** fix-register-flow
**Type:** Bugfix
**Status:** Proposed

## Problem

The Prompt Registration flow (PRD Flow 1) has two blockers:

1. **Storage upload is fake**: The register page sends a placeholder string
   (`"0x" + ciphertext.slice(2,10) + "...placeholder"`) instead of actually
   uploading the encrypted prompt to 0G Storage. `uploadToStorage()` in
   `lib/storage.ts` is implemented but never called.

2. **On-chain transaction fails**: `walletClient.writeContract()` calls
   `eth_sendTransaction` which is not supported by the public 0G testnet RPC.
   Viem needs to sign locally and use `eth_sendRawTransaction` instead.

## Proposed Solution

### Storage Upload
Move the 0G Storage upload to the API route. The client sends the encrypted
data (ciphertext + iv), the server uploads it to 0G Storage, gets the rootHash,
then registers on-chain with that hash.

### On-chain Transaction
Pass `account` explicitly to `writeContract()` so viem signs locally with
`eth_sendRawTransaction`. Alternative: use `sendTransaction` directly.

## Capabilities Affected

- **register** — Registration flow (storage upload + on-chain tx)

## Scope

### In Scope
- Modify `POST /api/prompts/register` to accept encrypted data and upload to 0G Storage
- Fix `writeContract` to sign locally
- Update `app/register/page.tsx` to send encrypted data instead of placeholder

### Out of Scope
- Execute flow (Flujo 2 PRD)
- Purchase flow (Flujo 3 PRD)
- Governance (Flujo 5 PRD)

## Success Criteria

1. Registering a prompt uploads encrypted data to 0G Storage → returns real rootHash
2. The on-chain `registerPrompt` transaction succeeds on 0G testnet
3. The prompt appears in the marketplace listing
4. End-to-end: write prompt → encrypt → upload → register → listed on marketplace
