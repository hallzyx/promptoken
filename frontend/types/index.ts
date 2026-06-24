/** Represents a registered prompt on-chain. */
export interface PromptData {
  id: number;
  author: `0x${string}`;
  storageHash: string;
  promptHash: `0x${string}`;
  metadataURI: string;
  createdAt: bigint;
  active: boolean;
}

/** Represents a version of a prompt. */
export interface VersionData {
  storageHash: string;
  timestamp: bigint;
  versionNumber: number;
}

/** Configuration for a monetization tier. */
export interface TierConfig {
  price: bigint;
  enabled: boolean;
}

/** Monetization tiers matching IPromptRegistry.Tier. */
export enum Tier {
  PayPerCall = 0,
  FixedLicense = 1,
  Plaintext = 2,
}
