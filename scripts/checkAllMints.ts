// scripts/checkAllMints.ts
// Run: npx ts-node --files scripts/checkAllMints.ts

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { findMetadataPda, fetchMetadata } from '@metaplex-foundation/mpl-token-metadata';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const mints = [
  '2wmpUpxsvAwwuuCbYi9yTWUosDmhBjTJDP1AQyWjSsyX', // #1
  '5d2wJ8bfLzUMbaPdNGfaMSG24M9tFok5Up1SpPLB7rg3', // #2
  '66QQ3UsJdRSh16iy5y6L9MX5JdRGekN3jFzMxBENrDL4', // #3
  'EWTv5spnG2jrxE4nZa2p4DHGhTTEEYkB5mgdQoMYWRX5', // #4
  '86M2y4coxMj9svBMPGP9FuQfCb8LP3EK6H5pa638fMob', // #5
  'G71jw7aHPMmrykVsQb3M4zNpSfRqsQXyqPREgjLSuiUe', // #6
  'Bc8JX4x157obmQE8P9pL9NNndseuArMCsQVzRwSLkTYm', // #7
  'F9JwnMDMUXdmXNaLbNoMg59FtJ61qXUUbxQeY3KaXCZW', // #8
  '6PCYvd3VEQ7VtCTQ1Y852uVAZen1ETkQKfkmKWS37Pa2', // #9
  'F4KKc7PYErS5Wgh3WYi7JvYRKpESUUuHgHcfvfzULLSc', // #10
];

(async () => {
  const umi = createUmi(RPC);

  for (const mint of mints) {
    try {
      const md = await fetchMetadata(umi, findMetadataPda(umi, { mint: publicKey(mint) }));

      // Handle Option type properly
      const colOpt: any = md.collection;
      let colSummary: string;

      if (!colOpt || colOpt.__option === 'None') {
        colSummary = 'collection: None';
      } else {
        const v = colOpt.value; // { verified: boolean, key: PublicKey }
        colSummary = `collection: { verified: ${v.verified}, key: ${v.key.toString()} }`;
      }

      console.log(`${mint} → name="${md.name}" symbol="${md.symbol}" | ${colSummary}`);
    } catch (e) {
      console.error(`${mint} → error:`, e);
    }
  }
})();

