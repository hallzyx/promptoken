# Promptoken — Smart Contracts

Smart contracts for Promptoken, a protocol for AI prompt IP on 0G Network.
Built with Solidity ^0.8.24, Hardhat, and OpenZeppelin.

## Architecture

Three contracts implementing a prompt IP registry with 3-tier monetization:

| Contract | Description |
|----------|-------------|
| **PromptRegistry** | Central IP registry — registers prompts with proof of authorship, immutable versioning, and tier configuration |
| **PromptLicense** | 3-tier monetization — pay-per-call, fixed license (subscription), and plaintext purchase |
| **PromptGovernance** | Decentralized custody transfer — license holders can vote to transfer prompt custody if author becomes unresponsive |

### Diagram (text-based)

```
Author ──→ PromptRegistry.registerPrompt()
              │
              ├── Creates promptId (counter)
              ├── Stores author, hash, metadata
              └── Enables tier configs

Consumer ──→ PromptLicense.purchaseCallLicense()
              │
              ├── Validates tier via PromptRegistry
              ├── Credits author balance (pull-over-push)
              └── Stores call counter

Author ──→ PromptLicense.withdrawFunds()
              └── Receives accumulated payments

LicenseHolders ──→ PromptGovernance.proposeTransfer()
                   → voteTransfer()
                   → executeTransfer()
                      └── Calls PromptRegistry.transferCustody()
```

## Stack

- **Language**: Solidity ^0.8.24
- **Framework**: Hardhat
- **EVM**: 0G Chain (cancun evmVersion)
- **Dependencies**: OpenZeppelin ^5.0.0 (Ownable, ReentrancyGuard, Pausable)
- **Testing**: Hardhat Test + Chai + ethers v6

## Prerequisites

- Node.js 18+
- npm or yarn
- A wallet with 0G testnet funds (Galileo testnet)

## Installation

```bash
npm install
```

## Environment

Copy `.env.example` to `.env` and fill in your private key:

```bash
cp .env.example .env
```

Required variables:

```
PRIVATE_KEY=your_private_key_with_0g_testnet_funds
L1_RPC=https://evmrpc-testnet.0g.ai
FLOW_ADDRESS=0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628
STORAGE_RPC=https://indexer-storage-testnet-turbo.0g.ai
```

## Compile

```bash
npx hardhat compile
```

## Test

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/PromptRegistry.test.js
npx hardhat test test/PromptLicense.test.js
npx hardhat test test/PromptGovernance.test.js
npx hardhat test test/Promptoken.test.js
```

## Deploy

### Local Hardhat Network

```bash
npx hardhat run scripts/deploy.js
```

### 0G Testnet (Galileo)

```bash
npx hardhat run scripts/deploy.js --network 0g-testnet
```

## Network Details

| Parameter | Value |
|-----------|-------|
| Network | 0G Galileo Testnet |
| RPC | https://evmrpc-testnet.0g.ai |
| Chain ID | 16602 |
| Explorer | https://chainscan-galileo.0g.ai |
| evmVersion | cancun |

## Contract Addresses (Testnet)

After deployment, addresses are saved to `deployment.json`.

## Security

- **ReentrancyGuard**: All payment functions protected against reentrancy
- **Pull-over-push**: Authors withdraw funds; never pushed in purchase functions
- **Pausable**: Owner can pause all contracts in emergency
- **Ownable**: Admin functions restricted to contract owner
- **Custom Errors**: Gas-efficient error handling (no string requires)

## Architecture Decisions

- **Counter-based IDs**: Prompts use auto-increment uint256 IDs (not ERC-1155) — they are non-transferable IP assets, not tokens
- **Native currency**: Payments in native 0G currency for MVP (gas-efficient, no extra token approvals)
- **3 separate contracts**: Separation of concerns — registry, licensing, and governance are independent domains
- **Pull-over-push**: Prevents reentrancy and follows checks-effects-interactions pattern

## License

MIT
