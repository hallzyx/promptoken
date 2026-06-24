import { keccak256, toBytes, toHex } from "viem";

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

/**
 * Derives an AES-256-GCM CryptoKey from a wallet signature.
 * The key material is keccak256(signature) to ensure deterministic
 * key derivation tied to the signer's wallet.
 *
 * @param walletSignature - The raw signature hex string from the wallet.
 * @returns A CryptoKey suitable for encrypt/decrypt operations.
 */
export async function generateKey(
  walletSignature: string,
): Promise<CryptoKey> {
  const hash = keccak256(toBytes(walletSignature as `0x${string}`));
  const keyBytes = toBytes(hash);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"],
  );

  return key;
}

/**
 * Encrypts a prompt string using AES-256-GCM.
 *
 * @param promptText - The plaintext prompt to encrypt.
 * @param key - The CryptoKey derived from the wallet signature.
 * @returns Object containing base64-encoded IV and ciphertext.
 */
export async function encryptPrompt(
  promptText: string,
  key: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(promptText);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data,
  );

  return {
    iv: toHex(iv),
    ciphertext: toHex(new Uint8Array(encrypted)),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted prompt.
 *
 * @param ciphertext - Hex-encoded ciphertext.
 * @param iv - Hex-encoded initialization vector.
 * @param key - The CryptoKey derived from the wallet signature.
 * @returns The decrypted plaintext string.
 */
export async function decryptPrompt(
  ciphertext: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  const ivBuffer = toBytes(iv as `0x${string}`).buffer as ArrayBuffer;
  const ciphertextBuffer = toBytes(
    ciphertext as `0x${string}`,
  ).buffer as ArrayBuffer;

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer },
    key,
    ciphertextBuffer,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
