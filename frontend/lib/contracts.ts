import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
  getContract,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { zeroGTestnet } from "./chain";

/* ------------------------------------------------------------------ */
/*  ABI definitions derived from Solidity interfaces                  */
/* ------------------------------------------------------------------ */

/**
 * ABI for IPromptRegistry (0x1337...)
 */
export const promptRegistryAbi = parseAbi([
  // --- writes ---
  "function transferCustody(uint256 promptId, address newCustodian) external",
  "function setGovernance(address governance) external",
  "function registerPrompt(string calldata storageHash, bytes32 promptHash, string calldata metadataURI, (uint256 price, bool enabled)[] calldata tiers) external returns (uint256 promptId)",
  "function publishVersion(uint256 promptId, string calldata newStorageHash) external",
  "function setTierConfig(uint256 promptId, uint8 tier, uint256 price, bool enabled) external",
  "function deactivatePrompt(uint256 promptId) external",
  // --- reads ---
  "function getPrompt(uint256 promptId) external view returns (address author, string storageHash, bytes32 promptHash, string metadataURI, uint256 createdAt, bool active)",
  "function getVersion(uint256 promptId, uint256 versionIndex) external view returns (string storageHash, uint256 timestamp, uint256 versionNumber)",
  "function getVersionCount(uint256 promptId) external view returns (uint256)",
  "function getAuthorPromptCount(address author) external view returns (uint256)",
  "function getPromptIdByIndex(address author, uint256 index) external view returns (uint256)",
  "function getTierConfig(uint256 promptId, uint8 tier) external view returns (uint256 price, bool enabled)",
  "function isPromptActive(uint256 promptId) external view returns (bool)",
]);

/**
 * ABI for IPromptLicense (0x75CD...)
 */
export const promptLicenseAbi = parseAbi([
  // --- writes ---
  "function purchaseCallLicense(uint256 promptId, uint256 calls) external payable",
  "function purchaseFixedLicense(uint256 promptId, uint256 durationDays) external payable",
  "function purchasePlaintext(uint256 promptId) external payable",
  "function executeCall(uint256 promptId, address consumer) external",
  "function withdrawFunds() external",
  "function claimRefund(uint256 promptId, bytes32 licenseId) external",
  // --- reads ---
  "function getRemainingCalls(uint256 promptId, address consumer) external view returns (uint256)",
  "function getLicenseExpiry(uint256 promptId, address consumer) external view returns (uint256)",
  "function getAuthorBalance(address author) external view returns (uint256)",
]);

/**
 * ABI for IPromptGovernance (0xcd4f...)
 */
export const promptGovernanceAbi = parseAbi([
  // --- writes ---
  "function proposeTransfer(uint256 promptId, address newCustodian) external returns (uint256 proposalId)",
  "function voteTransfer(uint256 proposalId, bool support) external",
  "function executeTransfer(uint256 proposalId) external",
  "function cancelProposal(uint256 proposalId) external",
  // --- reads ---
  "function getProposal(uint256 proposalId) external view returns (uint256 promptId, address newCustodian, address proposer, uint256 deadline, bool executed, uint256 votesFor, uint256 votesAgainst)",
  "function getProposalVoteCount(uint256 proposalId) external view returns (uint256 forVotes, uint256 againstVotes)",
  "function getQuorumPercentage() external view returns (uint256)",
  "function getVotingDuration() external view returns (uint256)",
]);

/* ------------------------------------------------------------------ */
/*  Addresses                                                         */
/* ------------------------------------------------------------------ */

export const PROMPT_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_PROMPT_REGISTRY as `0x${string}`) ||
  "0x1337CcF29d030005A3388839C76d9E30C73C708B";

export const PROMPT_LICENSE_ADDRESS =
  (process.env.NEXT_PUBLIC_PROMPT_LICENSE as `0x${string}`) ||
  "0x75CDdB80a27DA07dBE654B58d008B78872e7a7a9";

export const PROMPT_GOVERNANCE_ADDRESS =
  (process.env.NEXT_PUBLIC_PROMPT_GOVERNANCE as `0x${string}`) ||
  "0xcd4f00b65729B69D757aa6fa513cdD8A6617699b";

/* ------------------------------------------------------------------ */
/*  Clients                                                           */
/* ------------------------------------------------------------------ */

/**
 * Public (read-only) viem client for 0G Galileo testnet.
 */
export const publicClient: PublicClient = createPublicClient({
  chain: zeroGTestnet,
  transport: http(),
});

/**
 * Creates a wallet client from an injected provider (e.g. MetaMask, RainbowKit).
 * @param account - The connected account address.
 * @returns A WalletClient for signing transactions.
 */
export function getWalletClient(
  account: Account,
): WalletClient {
  return createWalletClient({
    account,
    chain: zeroGTestnet,
    transport: custom(window.ethereum!),
  });
}

/* ------------------------------------------------------------------ */
/*  Contract instances (read-only via public client)                  */
/* ------------------------------------------------------------------ */

export const promptRegistryContract = getContract({
  address: PROMPT_REGISTRY_ADDRESS,
  abi: promptRegistryAbi,
  client: publicClient,
});

export const promptLicenseContract = getContract({
  address: PROMPT_LICENSE_ADDRESS,
  abi: promptLicenseAbi,
  client: publicClient,
});

export const promptGovernanceContract = getContract({
  address: PROMPT_GOVERNANCE_ADDRESS,
  abi: promptGovernanceAbi,
  client: publicClient,
});
