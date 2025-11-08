// scripts/readCollectionMeta.ts
// Purpose: check updateAuthority and collectionDetails.
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { fetchMetadata, findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const umi = createUmi(RPC);
const collectionMint = publicKey('F2oFksfgM7JxaMSnH8EAPC2fkejSiNFqh4e27BpAAKLa');

(async () => {
  const pda = findMetadataPda(umi, { mint: collectionMint });
  const md = await fetchMetadata(umi, pda);
  console.log('updateAuthority:', md.updateAuthority.toString());
  console.log('has collectionDetails (must be true):', !!md.collectionDetails);
  console.log('tokenStandard:', md.tokenStandard);
})();

