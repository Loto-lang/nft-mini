// Purpose: ensure the item points to the correct collection mint.
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { fetchMetadata, findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const umi = createUmi(RPC);
const itemMint = publicKey('doza2rn8i1JLH6GfRFy9uinGF3N3Bo2gV4Pi8c1tV1L');

(async () => {
  const pda = findMetadataPda(umi, { mint: itemMint });
  const md = await fetchMetadata(umi, pda);
  console.log('name:', md.name, 'symbol:', md.symbol);
  console.log('collection field:', md.collection); // { key, verified } or null
})();


