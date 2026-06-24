# Promptoken — AI Prompt Marketplace on 0G Network

Promptoken is a protocol for AI prompt IP on the 0G Network. It enables authors to register, license, and govern their prompts with on-chain monetisation, and consumers to discover and execute prompts against LLMs.

## Architecture

Three smart contracts implementing a prompt IP registry with 3-tier monetisation:

| Contract | Description |
|----------|-------------|
| **PromptRegistry** | Central IP registry — registers prompts with proof of authorship, immutable versioning, and tier configuration |
| **PromptLicense** | 3-tier monetisation — pay-per-call, fixed license (subscription), and plaintext purchase |
| **PromptGovernance** | Decentralised custody transfer — license holders can vote to transfer prompt custody if author becomes unresponsive |

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

---

## Stack

### Smart Contracts

| Layer | Technology |
|-------|-----------|
| Language | Solidity ^0.8.24 |
| Framework | Hardhat |
| EVM | 0G Chain (cancun evmVersion) |
| Dependencies | OpenZeppelin ^5.0.0 (Ownable, ReentrancyGuard, Pausable) |
| Testing | Hardhat Test + Chai + ethers v6 |

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript, React 19 |
| Styling | Tailwind CSS v4 + StellarFlow design system |
| Wallet | RainbowKit + wagmi v2 + viem v2 |
| Auth | NextAuth v5 + SIWE (Sign-In with Ethereum) |
| Storage | 0G Storage SDK (@0glabs/0g-ts-sdk) |

---

## Frontend Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- A browser wallet (e.g. MetaMask, Rainbow) with 0G testnet funds

### Installation

```bash
cd frontend
npm install
```

### Environment

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_L1_RPC` | 0G testnet RPC endpoint |
| `NEXT_PUBLIC_STORAGE_RPC` | 0G storage indexer endpoint |
| `NEXT_PUBLIC_PROMPT_REGISTRY` | Deployed PromptRegistry address |
| `NEXT_PUBLIC_PROMPT_LICENSE` | Deployed PromptLicense address |
| `NEXT_PUBLIC_PROMPT_GOVERNANCE` | Deployed PromptGovernance address |
| `NEXTAUTH_SECRET` | Secret for NextAuth JWT encryption |
| `NEXTAUTH_URL` | Application URL (http://localhost:3000 for dev) |
| `PRIVATE_KEY` | Server wallet private key (for executing prompts) |

### Run Development Server

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Build

```bash
cd frontend
npm run build
```

---

## Available API Routes

All API routes are prefixed with `/api/` and use the `nodejs` runtime.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/prompts` | GET | List prompts (optional `?author=`, `&page=`, `&limit=`) |
| `/api/prompts/[id]` | GET | Full prompt detail including tiers and version history |
| `/api/prompts/register` | POST | Register a new prompt on-chain |
| `/api/prompts/[id]/execute` | POST | Execute a prompt with a user message (requires license) |
| `/api/prompts/[id]/purchase` | POST | Get purchase estimate for a license tier |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth SIWE authentication handler |

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { /* response data */ }
}
```

On error:

```json
{
  "success": false,
  "error": "Error description"
}
```

---

## Frontend Architecture

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Marketplace | Browse prompts with search/filter, connect wallet CTA |
| `/prompts/[id]` | Prompt Detail | Full prompt view, tier purchase, execute prompt |
| `/register` | Register Wizard | 4-step wizard: connect → write → configure tiers → confirm |
| `/dashboard` | Author Dashboard | Manage prompts, view earnings, withdraw funds |
| `/dashboard/consumer` | Consumer Dashboard | View active licenses, remaining calls, expiry |

### Component Structure

```
components/
├── nav-bar.tsx            # Glass-effect navigation bar
├── providers.tsx          # Root providers (wagmi, RainbowKit, NextAuth)
├── wallet-connect.tsx     # RainbowKit ConnectButton wrapper
├── prompt-card.tsx        # Individual prompt card (surface bg, mono labels)
├── prompt-grid.tsx        # Responsive grid with loading/empty/error states
└── dashboard/
    ├── earnings-card.tsx  # Author earnings display + withdraw
    ├── prompt-list.tsx    # Author's prompt list
    └── license-table.tsx  # Consumer license status table
```

### Design System (StellarFlow)

The frontend follows the **StellarFlow** design system defined in `.design/design.md`:

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#131313` | Page background |
| `primary` | `#b7c4ff` | Brand highlights, links |
| `primary-container` | `#3d4fb0` | Buttons, CTAs |
| `secondary` | `#ffe575` | AI badges, special elements |
| `surface` | `#1f1f1f` | Cards, elevated sections |
| `on-surface-variant` | `#c3c5d9` | Secondary text |
| `outline-variant` | `#434656` | All borders (1px, no shadows) |

Key patterns:
- **Fonts**: Inter (headings/body), JetBrains Mono (labels/buttons/data)
- **Labels**: Uppercase, wide tracking (`tracking-widest`), 10-12px
- **Borders**: Always 1px `#434656`, **no shadows**
- **Navigation**: Glass effect (`backdrop-blur-md bg-background/80`) with bottom border
- **Technical grid**: Radial-gradient dot pattern (`background-size: 40px 40px`) on hero sections
- **Cards**: `border-outline-variant`, `bg-surface`, generous padding

---

## Running the Full Application

### 1. Deploy Contracts

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Deploy to 0G testnet
npx hardhat run scripts/deploy.js --network 0g-testnet
```

### 2. Configure Frontend

Copy the deployed addresses from `deployment.json` to the frontend's `.env.local`.

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

### 4. Browse

Open `http://localhost:3000`, connect your wallet, and browse the marketplace.

---

## Prerequisites (Smart Contracts)

- Node.js 18+
- npm or yarn
- A wallet with 0G testnet funds (Galileo testnet)

## Installation (Smart Contracts)

```bash
npm install
```

## Environment (Smart Contracts)

Copy `.env.example` to `.env`:

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

## Compile (Smart Contracts)

```bash
npx hardhat compile
```

## Test (Smart Contracts)

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/PromptRegistry.test.js
npx hardhat test test/PromptLicense.test.js
npx hardhat test test/PromptGovernance.test.js
npx hardhat test test/Promptoken.test.js
```

## Deploy (Smart Contracts)

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
