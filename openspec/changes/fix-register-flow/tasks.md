# Tasks: Fix Register Flow

**Change ID:** fix-register-flow

## Phase 1: API Route — Storage Upload

- [ ] **1.1** Add `encryptedData` and `iv` to accepted body params in POST handler
- [ ] **1.2** Convert hex strings to `Uint8Array` and call `uploadToStorage()`
- [ ] **1.3** Use returned `rootHash` as `storageHash` for on-chain registration
- [ ] **1.4** Build metadata JSON with iv + author embedded

## Phase 2: API Route — Fix On-chain Transaction

- [ ] **2.1** Add `account: serverAccount` explicitly to `simulateContract()`
- [ ] **2.2** Add `account: serverAccount` explicitly to `writeContract()`
- [ ] **2.3** Normalize private key (`0x` prefix) before `privateKeyToAccount()`

## Phase 3: Register Page — Send Real Data

- [ ] **3.1** Update request body to send `encryptedData` (ciphertext) and `iv`
- [ ] **3.2** Remove placeholder `storageHash` construction
- [ ] **3.3** Show real `storageHash` in success screen

## Phase 4: Verify

- [ ] **4.1** `npm run build` — verify no compilation errors
- [ ] **4.2** Test register endpoint via curl with mock encrypted data
- [ ] **4.3** Verify storageHash is real (not placeholder)
- [ ] **4.4** Verify on-chain tx succeeds (eth_sendRawTransaction)
