// scripts/readItemMetaMint.ts
// Run: npx ts-node --files scripts/readItemMetaMint.ts <mint>

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { findMetadataPda, fetchMetadata } from '@metaplex-foundation/mpl-token-metadata';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const [mintStr] = process.argv.slice(2);
if (!mintStr) { console.error('Usage: readItemMetaMint.ts <mint>'); process.exit(1); }

(async () => {
  const umi = createUmi(RPC);
  const md = await fetchMetadata(umi, findMetadataPda(umi, { mint: publicKey(mintStr) }));
  console.log('mint:', mintStr);
  console.log('name:', md.name, 'symbol:', md.symbol);
  console.log('collection:', md.collection);
  console.log('uri:', md.uri);
})();

