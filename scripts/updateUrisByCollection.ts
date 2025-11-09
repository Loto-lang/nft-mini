// Usage: npx ts-node scripts/updateUrisByCollection.ts <COLLECTION_MINT> <METADATA_CID> [--dry]
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { signerIdentity, createSignerFromKeypair, publicKey } from "@metaplex-foundation/umi";
import { mplTokenMetadata, updateV1, findMetadataPda, fetchMetadata } from "@metaplex-foundation/mpl-token-metadata";
import * as fs from "fs";
import * as path from "path";
// Use native fetch from Node >= 18 (no import needed)

// Minimal DAS client
async function getAssetsByCollection(dasUrl: string, collectionMint: string) {
  const body = {
    jsonrpc: "2.0",
    id: "upd",
    method: "getAssetsByGroup",
    params: {
      groupKey: "collection",
      groupValue: collectionMint,
      page: 1,
      limit: 1000,
      displayOptions: { showUnverifiedCollections: true },
    },
  };
  const r = await fetch(dasUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return j?.result?.items ?? [];
}

function extractIndexFromName(name?: string): number | null {
  if (!name) return null;
  // Accept "1", "NFT #1", "Mini #001", etc.
  const m = name.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const [collectionMint, metadataCid, flag] = process.argv.slice(2);
  const DRY = flag === "--dry";
  if (!collectionMint || !metadataCid) {
    console.error("Usage: npx ts-node scripts/updateUrisByCollection.ts <COLLECTION_MINT> <METADATA_CID> [--dry]");
    process.exit(1);
  }

  const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
  const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR ?? path.join(process.env.HOME || "", ".config/solana/id.json");
  const HELIUS_DAS = process.env.HELIUS_DAS;
  if (!HELIUS_DAS) {
    console.error("Set HELIUS_DAS (DAS endpoint) in env.");
    process.exit(1);
  }

  console.log(`Collection: ${collectionMint}`);
  console.log(`Metadata CID (folder): ${metadataCid}`);
  console.log(`DAS: ${HELIUS_DAS}`);
  console.log(DRY ? "Mode: DRY RUN (no on-chain writes)" : "Mode: LIVE (will update on-chain)");

  // Load signer
  const umi = createUmi(RPC).use(mplTokenMetadata());
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8")) as number[];
  const kp = umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(secret));
  const signer = createSignerFromKeypair(umi, kp);
  umi.use(signerIdentity(signer));

  // Fetch assets in collection
  const assets = await getAssetsByCollection(HELIUS_DAS, collectionMint);
  console.log(`Found ${assets.length} assets`);

  let ok = 0, fail = 0;
  for (const a of assets) {
    const mint: string = a.id;
    const name: string = a.content?.metadata?.name || a.content?.json?.name || mint;
    const i = extractIndexFromName(name);
    if (!i) { console.log(`Skip (no index): ${name} ${mint}`); continue; }

    const newUri = `https://amethyst-academic-hamster-437.mypinata.cloud/ipfs/${metadataCid}/${i}.json`;

    try {
      console.log(`→ ${name} (${mint})  URI := ${newUri}`);
      if (!DRY) {
        // Fetch existing metadata to preserve other fields
        const mintPubkey = publicKey(mint);
        const metadataPda = findMetadataPda(umi, { mint: mintPubkey });
        const existingMetadata = await fetchMetadata(umi, metadataPda);
        
        // Update only the URI while preserving other fields
        await updateV1(umi, {
          mint: mintPubkey,
          data: {
            name: existingMetadata.name,
            symbol: existingMetadata.symbol,
            uri: newUri,
            sellerFeeBasisPoints: existingMetadata.sellerFeeBasisPoints,
            creators: existingMetadata.creators,
          },
        }).sendAndConfirm(umi);
      }
      ok++;
    } catch (e: any) {
      console.error(`✗ ${name} (${mint})`, e?.message || e);
      fail++;
    }
  }
  console.log(`Done. OK=${ok} FAIL=${fail} (of ${assets.length})`);
}

main().catch(e => { console.error(e); process.exit(1); });


