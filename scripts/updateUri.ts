// scripts/updateUri.ts
// Usage: npx ts-node scripts/updateUri.ts <MINT> <NEW_JSON_URI>
// Env:   SOLANA_RPC=...  SOLANA_KEYPAIR=...  HELIUS_DAS=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { signerIdentity, createSignerFromKeypair, publicKey } from "@metaplex-foundation/umi";
import { mplTokenMetadata, updateV1, findMetadataPda, fetchMetadata } from "@metaplex-foundation/mpl-token-metadata";
import * as fs from "fs";
import * as path from "path";

// -------- Helpers (English comments) ---------------------------------

function ipfsToHttp(u: string) {
  if (!u) return u;
  if (u.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${u.slice(7)}`;
  return u;
}

async function httpOk(url: string, method: "GET" | "HEAD" = "HEAD") {
  try {
    const r = await fetch(url, { method, cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

async function fetchJson(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
  return r.json();
}

// Read current on-chain json_uri via Helius DAS
async function getOnChainUriViaDas(mint: string, dasEndpoint?: string): Promise<string | undefined> {
  if (!dasEndpoint) return undefined;
  const body = {
    jsonrpc: "2.0",
    id: "uri",
    method: "getAsset",
    params: { id: mint, displayOptions: { showUnverifiedCollections: true } },
  };
  const r = await fetch(dasEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return j?.result?.content?.json_uri as string | undefined;
}

async function waitForUriPropagation(
  mint: string,
  expected: string,
  dasEndpoint: string,
  tries = 8,
  delayMs = 1000
) {
  for (let i = 0; i < tries; i++) {
    const now = await getOnChainUriViaDas(mint, dasEndpoint);
    if (now === expected) return true;
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return false;
}

// ---------------------------------------------------------------------

async function main() {
  const [mintStr, newUriRaw] = process.argv.slice(2);
  if (!mintStr || !newUriRaw) {
    console.error("Usage: npx ts-node scripts/updateUri.ts <MINT> <NEW_JSON_URI>");
    process.exit(1);
  }

  const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
  const KEYPAIR_PATH =
    process.env.SOLANA_KEYPAIR ?? path.join(process.env.HOME || "", ".config/solana/id.json");
  const HELIUS_DAS = process.env.HELIUS_DAS; // recommended

  // --- Preflight: show current on-chain URI (if DAS available)
  const currentUri = await getOnChainUriViaDas(mintStr, HELIUS_DAS);
  console.log("Current on-chain json_uri:", currentUri ?? "(DAS not configured)");

  // --- Preflight: validate NEW JSON URI
  const newUriHttp = newUriRaw.startsWith("ipfs://") ? ipfsToHttp(newUriRaw) : newUriRaw;
  console.log("New JSON URI (input):", newUriRaw);
  console.log("New JSON URI (HTTP): ", newUriHttp);

  // 1) Check JSON is reachable and valid
  const meta = await fetchJson(newUriHttp);
  if (typeof meta?.image !== "string" || meta.image.length === 0) {
    throw new Error("Invalid metadata: missing 'image' string field.");
  }

  // 2) Check image is likely reachable (best-effort)
  const imgHttp = ipfsToHttp(meta.image);
  const imgReachable = (await httpOk(imgHttp, "HEAD")) || (await httpOk(imgHttp, "GET"));
  if (!imgReachable) {
    console.warn(`[warn] Image not reachable right now: ${imgHttp}`);
  } else {
    console.log("Image reachable:", imgHttp);
  }

  // --- Build Umi + signer and update on-chain
  const umi = createUmi(RPC).use(mplTokenMetadata());
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8")) as number[];
  const kp = umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(secret));
  const signer = createSignerFromKeypair(umi, kp);
  umi.use(signerIdentity(signer));

  // Fetch existing metadata to preserve other fields
  const mintPubkey = publicKey(mintStr);
  const metadataPda = findMetadataPda(umi, { mint: mintPubkey });
  const existingMetadata = await fetchMetadata(umi, metadataPda);

  // Update only the URI while preserving other fields
  const { signature } = await updateV1(umi, {
    mint: mintPubkey,
    data: {
      name: existingMetadata.name,
      symbol: existingMetadata.symbol,
      uri: newUriRaw, // you can set ipfs:// or https://
      sellerFeeBasisPoints: existingMetadata.sellerFeeBasisPoints,
      creators: existingMetadata.creators,
    },
  }).sendAndConfirm(umi);

  console.log("✓ Metadata URI updated");
  console.log("Tx:", signature);

  // --- Post-check: confirm via DAS that on-chain json_uri == newUriRaw
  if (HELIUS_DAS) {
    const ok = await waitForUriPropagation(mintStr, newUriRaw, HELIUS_DAS);
    if (!ok) {
      console.warn("[warn] DAS did not reflect the new URI yet (eventual consistency).");
    } else {
      console.log("✓ DAS shows the new json_uri.");
    }
  } else {
    console.warn("[warn] HELIUS_DAS not set: skipping on-chain confirmation step.");
  }

  // --- Final check: fetch JSON again (gateway) and print image
  try {
    const meta2 = await fetchJson(newUriHttp);
    console.log("New metadata.name:", meta2?.name);
    console.log("New metadata.image:", meta2?.image);
  } catch {
    console.warn("[warn] Could not refetch the JSON (gateway timing). Try again in a moment.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
