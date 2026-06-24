# Design: Fix Register Flow

**Change ID:** fix-register-flow

## Architecture Decisions

### ADR-001: Server-side storage upload

**Decision:** The API route (`/api/prompts/register`) uploads encrypted data to
0G Storage server-side, then uses the returned rootHash for on-chain registration.

**Rationale:**
- `uploadToStorage()` uses `fs` and `ZgFile` which require Node.js runtime
- Moving upload to the server keeps the client simple (just send encrypted bytes)
- Single API call: client sends data → server uploads → server registers on-chain
- Avoids exposing the 0G Storage SDK on the client

**Alternative considered:**
- Client uploads first, then sends rootHash to API. Rejected because 0G SDK uses
  Node.js APIs (fs, Buffer) not available in browser.

### ADR-002: Fix viem writeContract with explicit account

**Decision:** Pass `account: serverAccount` explicitly to `writeContract()` and
`simulateContract()` to ensure viem signs locally via `eth_sendRawTransaction`.

**Rationale:**
- The public 0G testnet RPC does not support `eth_sendTransaction` (signing on node)
- Viem's `createWalletClient` with `account` should sign locally, but when
  `writeContract` receives a `request` from `simulateContract`, the account may
  not be propagated correctly
- Explicitly passing `account` in every call ensures consistent behavior

**Alternative considered:**
- Using `sendTransaction` with raw data. More verbose but equally valid.
  Chose `writeContract` with explicit account for readability.

### ADR-003: Store encrypted data as hex in metadata

**Decision:** Embed the encrypted payload (ciphertext + iv) in the `metadataURI`
field as a JSON string on-chain. The raw encrypted blob goes to 0G Storage.

**Rationale:**
- `metadataURI` on-chain is a pointer to metadata. For MVP we store the metadata
  inline (JSON stringified) since we don't have an IPFS/off-chain metadata server
- The actual encrypted prompt goes to 0G Storage (verifiable, Merkle-provable)
- metadataURI duplicates some data (iv, author) for convenience — the source of
  truth is 0G Storage

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/api/prompts/register/route.ts` | Modify | Accept encryptedData + iv, upload to 0G Storage, register on-chain |
| `app/register/page.tsx` | Modify | Send encryptedData + iv instead of placeholder storageHash |
| `lib/storage.ts` | Verify | Already implemented, no changes needed |

## Data Flow

```
Client (browser)                          Server (API route)
─────────────────                         ───────────────────
1. User writes prompt
2. Signs with wallet → derives key
3. Encrypts prompt (AES-256-GCM)
   → ciphertext, iv
4. POST /api/prompts/register ──────────→ 5. Upload ciphertext to 0G Storage
   { encryptedData, iv,                    → rootHash
     promptHash, metadata, tiers }        6. walletClient.writeContract({
                                             registerPrompt(rootHash, ...)
                                           })
                                          7. Return { promptId, txHash, rootHash }
8. Show success ←─────────────────────────
```
