import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";

/**
 * Uploads encrypted data to 0G Storage and returns the storage root hash.
 *
 * Note: This module uses Node.js APIs (fs, Buffer) from the 0G SDK,
 * so it must only be called from server-side code or Next.js server
 * actions/routes (runtime: 'nodejs').
 *
 * @param encryptedData - The encrypted prompt data as a Uint8Array.
 * @returns The storage root hash used to retrieve the data.
 */
export async function uploadToStorage(
  encryptedData: Uint8Array,
): Promise<string> {
  const storageRpc =
    process.env.NEXT_PUBLIC_STORAGE_RPC ||
    "https://indexer-storage-testnet-turbo.0g.ai";
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is not set in environment");
  }

  const provider = new ethers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_L1_RPC || "https://evmrpc-testnet.0g.ai",
  );
  const wallet = new ethers.Wallet(privateKey, provider);

  // Write encrypted data to a temp file for ZgFile
  const tmpPath = `/tmp/promptoken-upload-${Date.now()}.bin`;
  const fs = await import("fs/promises");
  await fs.writeFile(tmpPath, Buffer.from(encryptedData));

  const file = await ZgFile.fromFilePath(tmpPath);
  try {
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr) throw new Error(`Merkle tree generation failed: ${treeErr}`);

    const indexer = new Indexer(storageRpc);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, uploadErr] = await (indexer as any).upload(
      file,
      process.env.NEXT_PUBLIC_L1_RPC || "https://evmrpc-testnet.0g.ai",
      wallet,
    );
    if (uploadErr) {
      throw new Error(`Upload failed: ${uploadErr}`);
    }

    return result.rootHash;
  } finally {
    await file.close();
    await fs.unlink(tmpPath).catch(() => {
      /* ignore cleanup errors */
    });
  }
}

/**
 * Downloads data from 0G Storage by its storage hash.
 *
 * @param storageHash - The root hash returned from uploadToStorage.
 * @returns The raw data as a Uint8Array.
 */
export async function downloadFromStorage(
  storageHash: string,
): Promise<Uint8Array> {
  const storageRpc =
    process.env.NEXT_PUBLIC_STORAGE_RPC ||
    "https://indexer-storage-testnet-turbo.0g.ai";

  const tmpPath = `/tmp/promptoken-download-${Date.now()}.bin`;
  const fs = await import("fs/promises");

  try {
    const indexer = new Indexer(storageRpc);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const downloadErr = await (indexer as any).download(storageHash, tmpPath, true);
    if (downloadErr) {
      throw new Error(`Download failed: ${downloadErr}`);
    }

    const data = await fs.readFile(tmpPath);
    return new Uint8Array(data);
  } finally {
    await fs.unlink(tmpPath).catch(() => {
      /* ignore cleanup errors */
    });
  }
}
