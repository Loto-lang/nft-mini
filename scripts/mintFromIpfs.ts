// scripts/mintFromIpfs.ts
// Build: npx tsc
// Run:   node dist/scripts/mintFromIpfs.js <CID> <start> <end> "<NamePrefix>" "<SYMBOL>"

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  generateSigner,
  signerIdentity,
  some,
  percentAmount,
} from "@metaplex-foundation/umi";
import {
  mplTokenMetadata,
  createNft,
  verifySizedCollectionItem,
  findMetadataPda,
  findMasterEditionPda,
} from "@metaplex-foundation/mpl-token-metadata";
import * as fs from "fs";
import * as path from "path";

const [CID, startStr, endStr, namePrefix, symbol] = process.argv.slice(2);
if (!CID || !startStr || !endStr || !namePrefix || !symbol) {
  console.error('Usage: node dist/scripts/mintFromIpfs.js <CID> <start> <end> "<NamePrefix>" "<SYMBOL>"');
  process.exit(1);
}
const start = parseInt(startStr, 10);
const end = parseInt(endStr, 10);
if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
  console.error("Invalid range: ensure <start> and <end> are integers and start <= end");
  process.exit(1);
}

// Prefer env override; fallback to your Helius devnet endpoint
const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR ?? path.join(process.env.HOME || "", ".config/solana/id.json");
const ROYALTIES = percentAmount(5, 2); // 5.00%

console.log("=".repeat(60));
console.log("NFT Minting Script - Starting");
console.log("=".repeat(60));
console.log("Parameters:");
console.log(`  CID: ${CID}`);
console.log(`  Range: ${start} to ${end} (${end - start + 1} items)`);
console.log(`  Name Prefix: ${namePrefix}`);
console.log(`  Symbol: ${symbol}`);
console.log(`  Royalties: 5.00%`);
console.log(`  RPC: ${RPC}`);
console.log(`  Keypair: ${KEYPAIR_PATH}`);
console.log("=".repeat(60));

function loadCliSigner(umi: ReturnType<typeof createUmi>) {
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8")) as number[];
  const kp = umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(secret));
  return createSignerFromKeypair(umi, kp);
}

async function main() {
  // Init Umi + identity (must be the collection update authority)
  console.log("\n[1/3] Initializing Umi and loading signer...");
  const umi = createUmi(RPC).use(mplTokenMetadata());
  const signer = loadCliSigner(umi);
  umi.use(signerIdentity(signer));
  console.log("✓ Fee payer (and update authority):", signer.publicKey.toString());

  // 1) Create a SIZED collection NFT (Master Edition + collectionDetails)
  console.log("\n[2/3] Creating SIZED collection NFT...");
  const collectionMint = generateSigner(umi);
  console.log(`  Collection mint address: ${collectionMint.publicKey.toString()}`);
  console.log(`  Collection name: ${namePrefix} Collection`);
  console.log(`  Collection symbol: ${symbol}`);
  console.log("  Sending transaction...");
  
  const { signature: collSig } = await createNft(umi, {
    mint: collectionMint,
    name: `${namePrefix} Collection`,
    symbol,
    uri: "ipfs://placeholder-collection.json", // TODO: point to your real collection JSON
    sellerFeeBasisPoints: ROYALTIES,
    isCollection: true, // creates a sized collection
    creators: some([{ address: signer.publicKey, verified: true, share: 100 }]),
  }).sendAndConfirm(umi);
  
  console.log("✓ Collection created successfully!");
  console.log(`  Collection Mint: ${collectionMint.publicKey.toString()}`);
  console.log(`  Transaction: ${collSig}`);

  // PDAs for the collection (required by sized verification)
  console.log("\n  Deriving collection PDAs...");
  const collectionMetadataPda = findMetadataPda(umi, { mint: collectionMint.publicKey });
  const collectionMasterEditionPda = findMasterEditionPda(umi, { mint: collectionMint.publicKey });
  console.log(`  Collection Metadata PDA: ${collectionMetadataPda.toString()}`);
  console.log(`  Collection Master Edition PDA: ${collectionMasterEditionPda.toString()}`);

  // 2) Mint items and verify (SIZED variant)
  console.log(`\n[3/3] Minting and verifying items (${end - start + 1} items)...`);
  console.log("=".repeat(60));
  
  let successCount = 0;
  let failCount = 0;
  const failedItems: number[] = [];
  
  for (let i = start; i <= end; i++) {
    const itemNum = i - start + 1;
    const totalItems = end - start + 1;
    console.log(`\n[${itemNum}/${totalItems}] Processing item #${i}...`);
    
    try {
      const mint = generateSigner(umi);
      const uri = `ipfs://${CID}/${i}.json`;
      console.log(`  Mint address: ${mint.publicKey.toString()}`);
      console.log(`  URI: ${uri}`);
      console.log(`  Name: ${namePrefix} #${i}`);
      console.log("  Sending mint transaction...");

      const { signature: mintSig } = await createNft(umi, {
        mint,
        name: `${namePrefix} #${i}`,
        symbol,
        uri,
        sellerFeeBasisPoints: ROYALTIES,
        creators: some([{ address: signer.publicKey, verified: true, share: 100 }]),
        // Set collection link on creation (unverified yet)
        collection: some({ key: collectionMint.publicKey, verified: false }),
      }).sendAndConfirm(umi);
      
      console.log(`  ✓ Minted successfully!`);
      console.log(`    Mint: ${mint.publicKey.toString()}`);
      console.log(`    Transaction: ${mintSig}`);

      // Derive item metadata PDA
      const metadataPda = findMetadataPda(umi, { mint: mint.publicKey });
      console.log(`  Item Metadata PDA: ${metadataPda.toString()}`);
      console.log("  Verifying collection link...");

      // Use the *sized* verification (avoids 0x66 error)
      const { signature: verifySig } = await verifySizedCollectionItem(umi, {
        metadata: metadataPda,                              // PDA of ITEM metadata (NOT the mint)
        collectionMint: collectionMint.publicKey,          // MINT of COLLECTION
        collection: collectionMetadataPda,                  // PDA of COLLECTION metadata
        collectionMasterEditionAccount: collectionMasterEditionPda, // PDA of COLLECTION master edition
        collectionAuthority: signer,                        // collection update authority (identity signs)
        payer: signer,                                     // Payer for the transaction
      }).sendAndConfirm(umi);
      
      console.log(`  ✓ Verified in collection!`);
      console.log(`    Verification Transaction: ${verifySig}`);
      successCount++;
    } catch (e: any) {
      // Print on-chain logs if available, then continue with the next item
      console.error(`  ❌ Failed at index #${i}`);
      if (e?.cause?.transactionLogs) {
        console.error("  Transaction logs:");
        console.error(e.cause.transactionLogs.join("\n"));
      } else {
        console.error("  Error:", e.message || e);
      }
      failCount++;
      failedItems.push(i);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Minting Complete - Summary");
  console.log("=".repeat(60));
  console.log(`Total items: ${end - start + 1}`);
  console.log(`✓ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  if (failedItems.length > 0) {
    console.log(`Failed item numbers: ${failedItems.join(", ")}`);
  }
  console.log(`Collection Mint: ${collectionMint.publicKey.toString()}`);
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

