"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { keccak256, toBytes } from "viem";
import { WalletConnect } from "@/components/wallet-connect";
import { generateKey, encryptPrompt } from "@/lib/encryption";
import { truncateAddress } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Wizard step labels                                                */
/* ------------------------------------------------------------------ */

const STEPS = ["Connect Wallet", "Write Prompt", "Configure Tiers", "Confirm & Register"];

/* ------------------------------------------------------------------ */
/*  Tier configuration type                                           */
/* ------------------------------------------------------------------ */

interface TierForm {
  enabled: boolean;
  price: string; // string input — parsed to wei on submit
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function RegisterPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [step, setStep] = useState(0);

  // Step 2 — prompt content
  const [promptText, setPromptText] = useState("");
  const [promptName, setPromptName] = useState("");
  const [promptDescription, setPromptDescription] = useState("");

  // Step 3 — tier configs
  const [tiers, setTiers] = useState<TierForm[]>([
    { enabled: false, price: "" },
    { enabled: false, price: "" },
    { enabled: false, price: "" },
  ]);

  // Step 4 — submission
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ promptId: number; txHash: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---- tier helpers ---- */
  const updateTier = (index: number, patch: Partial<TierForm>) => {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
  };

  /* ---- validation ---- */
  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return isConnected;
      case 1:
        return promptText.trim().length > 0;
      case 2: {
        const enabled = tiers.filter((t) => t.enabled);
        return (
          enabled.length > 0 &&
          enabled.every((t) => t.price.trim() !== "" && Number(t.price) > 0)
        );
      }
      default:
        return true;
    }
  };

  /* ---- submit handler ---- */
  const handleSubmit = async () => {
    if (!address || !isConnected) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1. Encrypt prompt
      //    Use wallet signature as encryption key material
      const sig = await signMessageAsync({
        message: `Register prompt on Promptoken: ${promptText.slice(0, 40)}…`,
      });
      const key = await generateKey(sig);
      const { iv, ciphertext } = await encryptPrompt(promptText, key);

      // 2. Upload to 0G Storage + register on-chain via server API
      const storageRes = await fetch("/api/prompts/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedData: ciphertext,
          iv,
          promptHash: keccak256(toBytes(promptText)),
          promptName,
          description: promptDescription,
          tiers: tiers.map((t) => ({
            price: BigInt(t.price).toString(),
            enabled: t.enabled,
          })),
        }),
      });

      const storageJson = await storageRes.json();
      if (!storageJson.success) {
        throw new Error(storageJson.error || "Registration failed");
      }

      setResult(storageJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- success screen ---- */
  if (result) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="rounded-lg border border-outline-variant bg-surface p-8">
          <p className="mb-3 font-mono text-xs tracking-widest uppercase text-secondary">
            ✓ Registered
          </p>
          <h1 className="mb-4 text-2xl font-bold text-white">
            Prompt Registered Successfully
          </h1>
          <div className="mb-6 space-y-2 text-left">
            <p className="font-mono text-xs text-on-surface-variant">
              Prompt ID:{" "}
              <span className="text-white">{result.promptId}</span>
            </p>
            <p className="truncate font-mono text-xs text-on-surface-variant">
              Tx:{" "}
              <span className="text-primary">{truncateAddress(result.txHash)}</span>
            </p>
          </div>
          <a
            href={`/prompts/${result.promptId}`}
            className="inline-block rounded-lg bg-primary-container px-6 py-3 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:bg-primary-container/80"
          >
            View Prompt →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* ── Heading ── */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tighter text-white">
          Register a Prompt
        </h1>
        <p className="text-sm text-on-surface-variant">
          Publish your prompt on the 0G Network and configure monetisation.
        </p>
      </div>

      {/* ── Progress indicator ── */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs ${
                i === step
                  ? "bg-primary-container text-white"
                  : i < step
                    ? "bg-primary-container/40 text-white/60"
                    : "border border-outline-variant text-on-surface-variant"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`hidden font-mono text-[10px] tracking-widest uppercase sm:inline ${
                i === step ? "text-white" : "text-on-surface-variant"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-on-surface-variant/30 mx-1">→</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Step content ── */}
      <div className="rounded-lg border border-outline-variant bg-surface p-8">
        {/* Step 1: Connect Wallet */}
        {step === 0 && (
          <div className="text-center">
            <p className="mb-2 font-mono text-xs tracking-widest uppercase text-on-surface-variant">
              Step 1 of 4
            </p>
            <h2 className="mb-6 text-xl font-semibold text-white">
              Connect Your Wallet
            </h2>
            {isConnected && address ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-background px-6 py-3">
                <span className="h-2 w-2 rounded-full bg-secondary" />
                <span className="font-mono text-sm text-white">
                  {truncateAddress(address)}
                </span>
              </div>
            ) : (
              <div className="inline-flex">
                <WalletConnect />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Write Prompt */}
        {step === 1 && (
          <div>
            <p className="mb-2 font-mono text-xs tracking-widest uppercase text-on-surface-variant">
              Step 2 of 4
            </p>
            <h2 className="mb-6 text-xl font-semibold text-white">
              Write Your Prompt
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  Prompt Name (optional)
                </label>
                <input
                  type="text"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="e.g. Code Review Assistant"
                  className="w-full rounded-lg border border-outline-variant bg-background px-4 py-2 font-mono text-sm text-white placeholder-on-surface-variant outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={promptDescription}
                  onChange={(e) => setPromptDescription(e.target.value)}
                  placeholder="Brief description of what this prompt does"
                  className="w-full rounded-lg border border-outline-variant bg-background px-4 py-2 font-mono text-sm text-white placeholder-on-surface-variant outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  Prompt Text *
                </label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={8}
                  placeholder="You are a helpful assistant that..."
                  className="w-full rounded-lg border border-outline-variant bg-background px-4 py-3 font-mono text-sm text-white placeholder-on-surface-variant outline-none focus:border-primary/50 resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Configure Tiers */}
        {step === 2 && (
          <div>
            <p className="mb-2 font-mono text-xs tracking-widest uppercase text-on-surface-variant">
              Step 3 of 4
            </p>
            <h2 className="mb-6 text-xl font-semibold text-white">
              Configure Monetisation Tiers
            </h2>
            <div className="space-y-4">
              {[
                { index: 0, label: "Pay Per Call", desc: "Charge per inference call" },
                { index: 1, label: "Fixed License", desc: "Time-limited license (days)" },
                { index: 2, label: "Plaintext", desc: "One-time plaintext purchase" },
              ].map(({ index, label, desc }) => (
                <div
                  key={index}
                  className="rounded-lg border border-outline-variant bg-background p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-white">{label}</p>
                      <p className="font-mono text-[10px] text-on-surface-variant">
                        {desc}
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={tiers[index].enabled}
                        onChange={(e) =>
                          updateTier(index, { enabled: e.target.checked })
                        }
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full border border-outline-variant bg-background after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-on-surface-variant after:transition-all peer-checked:bg-primary-container peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                    </label>
                  </div>
                  {tiers[index].enabled && (
                    <div className="flex items-center gap-2">
                      <label className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                        Price (wei):
                      </label>
                      <input
                        type="text"
                        value={tiers[index].price}
                        onChange={(e) =>
                          updateTier(index, { price: e.target.value })
                        }
                        placeholder="1000000000000000000"
                        className="flex-1 rounded border border-outline-variant bg-surface px-3 py-1.5 font-mono text-xs text-white placeholder-on-surface-variant outline-none focus:border-primary/50"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Confirm & Register */}
        {step === 3 && (
          <div>
            <p className="mb-2 font-mono text-xs tracking-widest uppercase text-on-surface-variant">
              Step 4 of 4
            </p>
            <h2 className="mb-6 text-xl font-semibold text-white">
              Confirm & Register
            </h2>
            <div className="mb-6 space-y-3">
              <div className="rounded border border-outline-variant bg-background p-3">
                <p className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  Name
                </p>
                <p className="font-mono text-xs text-white">
                  {promptName || "(unnamed)"}
                </p>
              </div>
              <div className="rounded border border-outline-variant bg-background p-3">
                <p className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  Description
                </p>
                <p className="font-mono text-xs text-white">
                  {promptDescription || "(no description)"}
                </p>
              </div>
              <div className="rounded border border-outline-variant bg-background p-3">
                <p className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  Author
                </p>
                <p className="font-mono text-xs text-white">
                  {truncateAddress(address || "")}
                </p>
              </div>
              <div className="rounded border border-outline-variant bg-background p-3">
                <p className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  Enabled Tiers
                </p>
                {tiers.filter((t) => t.enabled).length === 0 ? (
                  <p className="font-mono text-xs text-red-400">
                    No tiers enabled
                  </p>
                ) : (
                  tiers
                    .filter((t) => t.enabled)
                    .map((t, i) => (
                      <p key={i} className="font-mono text-xs text-white">
                        {["Pay Per Call", "Fixed License", "Plaintext"][
                          tiers.indexOf(t)
                        ]}{" "}
                        — {t.price} wei
                      </p>
                    ))
                )}
              </div>
              <div className="rounded border border-outline-variant bg-background p-3">
                <p className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  Prompt Preview
                </p>
                <p className="line-clamp-3 font-mono text-xs text-on-surface-variant">
                  {promptText}
                </p>
              </div>
            </div>

            {error && (
              <p className="mb-4 font-mono text-xs text-red-400">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-lg bg-primary-container px-6 py-3 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:bg-primary-container/80 disabled:opacity-50"
            >
              {submitting
                ? "Encrypting & Registering…"
                : "Sign & Register Prompt"}
            </button>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-8 flex items-center justify-between border-t border-outline-variant pt-6">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="font-mono text-xs tracking-widest uppercase text-on-surface-variant transition-colors hover:text-white disabled:opacity-30"
          >
            ← Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canProceed()}
              className="rounded-lg bg-primary-container px-6 py-2 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:bg-primary-container/80 disabled:opacity-50"
            >
              Next →
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}
