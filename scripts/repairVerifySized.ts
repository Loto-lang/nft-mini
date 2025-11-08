// scripts/repairVerifySized.ts
// Run: npx ts-node --files scripts/repairVerifySized.ts

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { signerIdentity, publicKey, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { findMetadataPda, findMasterEditionPda, verifySizedCollectionItem } from '@metaplex-foundation/mpl-token-metadata';
import * as fs from 'fs';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const KEYPAIR = process.env.SOLANA_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`;
const secret = JSON.parse(fs.readFileSync(KEYPAIR, 'utf8'));

// Create Umi instance and convert keypair to Umi signer
const umi = createUmi(RPC);
const kp = umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(secret));
const signer = createSignerFromKeypair(umi, kp);

// Umi identity MUST be the collection update authority
umi.use(signerIdentity(signer));

const collectionMint = publicKey('BgfASAzhzACN9NRFDgQqb1jy19bHg3D2diwZTgKGRneG');
const failed = [
  '2wmpUpxsvAwwuuCbYi9yTWUosDmhBjTJDP1AQyWjSsyX', // #1
  '5d2wJ8bfLzUMbaPdNGfaMSG24M9tFok5Up1SpPLB7rg3', // #2
  'Bc8JX4x157obmQE8P9pL9NNndseuArMCsQVzRwSLkTYm', // #7
  'F9JwnMDMUXdmXNaLbNoMg59FtJ61qXUUbxQeY3KaXCZW', // #8
  '6PCYvd3VEQ7VtCTQ1Y852uVAZen1ETkQKfkmKWS37Pa2', // #9
  'F4KKc7PYErS5Wgh3WYi7JvYRKpESUUuHgHcfvfzULLSc', // #10
];

(async () => {
  const colMd = findMetadataPda(umi, { mint: collectionMint });
  const colMe = findMasterEditionPda(umi, { mint: collectionMint });

  console.log(`Processing ${failed.length} failed items...`);
  console.log(`Collection Mint: ${collectionMint.toString()}`);
  console.log(`Collection Metadata PDA: ${colMd.toString()}`);
  console.log(`Collection Master Edition PDA: ${colMe.toString()}`);
  console.log('='.repeat(60));

  for (let i = 0; i < failed.length; i++) {
    const m = failed[i];
    const itemNum = i + 1;
    console.log(`\n[${itemNum}/${failed.length}] Processing item: ${m}`);
    
    const itemMint = publicKey(m);
    const itemMd = findMetadataPda(umi, { mint: itemMint });
    console.log(`  Item Mint: ${itemMint.toString()}`);
    console.log(`  Item Metadata PDA: ${itemMd.toString()}`);
    console.log('  Attempting verification...');
    
    try {
      await verifySizedCollectionItem(umi, {
        metadata: itemMd,
        collectionMint,
        collection: colMd,
        collectionMasterEditionAccount: colMe,
        collectionAuthority: signer,
        payer: signer,
      }).sendAndConfirm(umi);
      console.log(`  ✅ Verified successfully: ${m}`);
    } catch (e: any) {
      console.error(`  ❌ Failed: ${m}`);
      if (e?.cause?.transactionLogs) {
        console.error('  Transaction logs:');
        console.error(e.cause.transactionLogs.join('\n'));
      } else {
        console.error('  Error:', e.message || e);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Repair verification complete');
  console.log('='.repeat(60));
})();

