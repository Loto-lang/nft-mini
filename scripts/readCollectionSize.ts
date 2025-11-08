// scripts/readCollectionSize.ts
// Run: npx ts-node --files scripts/readCollectionSize.ts

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { findMetadataPda, fetchMetadata } from '@metaplex-foundation/mpl-token-metadata';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const COLLECTION_MINT = process.env.COLLECTION ?? 'BgfASAzhzACN9NRFDgQqb1jy19bHg3D2diwZTgKGRneG';

(async () => {
  const umi = createUmi(RPC);
  const mdPda = findMetadataPda(umi, { mint: publicKey(COLLECTION_MINT) });
  const md = await fetchMetadata(umi, mdPda);
  console.log('isCollection:', !!md.collectionDetails);
  console.log('collectionDetails:', md.collectionDetails); // for sized collections: { size }
  // For sized collections, "size" is the count of verified items.
})();
