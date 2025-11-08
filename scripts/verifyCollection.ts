// scripts/verifyCollectionSized.ts
// Purpose: verify the collection link for a SIZED collection.
// Run with: npx ts-node --files scripts/verifyCollectionSized.ts

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { signerIdentity, publicKey, createSignerFromKeypair } from '@metaplex-foundation/umi';
import {
  findMetadataPda,
  findMasterEditionPda,
  verifySizedCollectionItem,
  setAndVerifySizedCollectionItem, // fallback if needed
} from '@metaplex-foundation/mpl-token-metadata';
import * as fs from 'fs';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`;
const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));

// Create Umi instance and convert keypair to Umi signer
const umi = createUmi(RPC);
const kp = umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(secret));
const signer = createSignerFromKeypair(umi, kp);

// Umi identity MUST be the collection update authority
umi.use(signerIdentity(signer));

// Addresses
const collectionMintStr = 'F2oFksfgM7JxaMSnH8EAPC2fkejSiNFqh4e27BpAAKLa';
const itemMintStr       = 'doza2rn8i1JLH6GfRFy9uinGF3N3Bo2gV4Pi8c1tV1L';

const collectionMint = publicKey(collectionMintStr);
const itemMint       = publicKey(itemMintStr);

(async () => {
  const itemMetadataPda        = findMetadataPda(umi, { mint: itemMint });
  const collectionMetadataPda  = findMetadataPda(umi, { mint: collectionMint });
  const collectionMasterEdPda  = findMasterEditionPda(umi, { mint: collectionMint });

  try {
    // Use the SIZED variant
    await verifySizedCollectionItem(umi, {
      metadata: itemMetadataPda,                      // PDA of ITEM metadata
      collectionMint,                                  // MINT of COLLECTION
      collection: collectionMetadataPda,               // PDA of COLLECTION metadata
      collectionMasterEditionAccount: collectionMasterEdPda, // PDA of COLLECTION master edition
      collectionAuthority: signer,                      // collection update authority (must sign)
      payer: signer,                                    // Payer for the transaction
    }).sendAndConfirm(umi);

    console.log('✅ verifySizedCollectionItem OK for', itemMintStr);
  } catch (e1: any) {
    console.error('⚠️ verifySizedCollectionItem failed, trying setAndVerifySizedCollectionItem...');
    try {
      // If the collection link wasn't set (rare in your case), do both in one call:
      await setAndVerifySizedCollectionItem(umi, {
        metadata: itemMetadataPda,
        collectionMint,
        collection: collectionMetadataPda,
        collectionMasterEditionAccount: collectionMasterEdPda,
        collectionAuthority: signer,
        payer: signer,
      }).sendAndConfirm(umi);
      console.log('✅ setAndVerifySizedCollectionItem OK for', itemMintStr);
    } catch (e2: any) {
      console.error('❌ sized verification failed');
      if (e2?.cause?.transactionLogs) console.error(e2.cause.transactionLogs.join('\n'));
      else if (e1?.cause?.transactionLogs) console.error(e1.cause.transactionLogs.join('\n'));
      else console.error(e2 ?? e1);
      process.exit(1);
    }
  }
})();

