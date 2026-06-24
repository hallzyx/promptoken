# Spec: Register Prompt Flow

**Capability:** register
**Version:** 1.0.0

## Requirements

### REQ-REG-001: Storage upload

The system SHALL upload encrypted prompt data to 0G Storage and return a real
root hash, not a placeholder.

#### Scenario: Encrypted prompt is uploaded to 0G Storage

- **GIVEN** a user has written a prompt and configured tiers
- **AND** the prompt has been encrypted client-side (ciphertext + iv)
- **WHEN** the client submits the registration
- **THEN** the API route uploads the encrypted data to 0G Storage
- **AND** returns a real root hash (64-char hex string)
- **AND** the root hash is verifiable via Merkle proof on 0G Storage

### REQ-REG-002: On-chain registration

The system SHALL register the prompt on 0G Chain via `PromptRegistry.registerPrompt`
with a valid signed transaction.

#### Scenario: Prompt is registered on-chain

- **GIVEN** the encrypted prompt has been uploaded to 0G Storage (rootHash obtained)
- **AND** a valid PRIVATE_KEY is configured
- **WHEN** the API route calls `registerPrompt` on PromptRegistry
- **THEN** the transaction is signed locally (eth_sendRawTransaction)
- **AND** the transaction succeeds on 0G Galileo testnet
- **AND** a promptId is returned
- **AND** a txHash is returned

### REQ-REG-003: End-to-end registration

The system SHALL accept encrypted data from the client, upload to storage, and
register on-chain in a single API call.

#### Scenario: Full registration flow succeeds

- **GIVEN** an authenticated user
- **WHEN** `POST /api/prompts/register` with `{ encryptedData, iv, promptHash, promptName, description, tiers }`
- **THEN** the encrypted data is uploaded to 0G Storage
- **AND** the prompt is registered on-chain with the real storage hash
- **AND** the response includes `{ promptId, txHash, storageHash }`

### REQ-REG-004: Client sends encrypted data

The register page SHALL send the actual encrypted ciphertext and IV to the API
route instead of a placeholder storage hash.

#### Scenario: Register page submits real data

- **GIVEN** the user completes the 4-step wizard
- **WHEN** the user clicks "Sign & Register Prompt"
- **THEN** the API request body includes `encryptedData` (hex ciphertext)
- **AND** `iv` (hex initialization vector)
- **AND** `promptHash` (keccak256 of plaintext)
- **AND** NOT a placeholder storageHash
