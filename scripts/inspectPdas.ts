// scripts/inspectPdas.ts
// Purpose: derive PDAs and print their owner programs (root cause of IncorrectOwner).
import { Connection, PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { findMetadataPda, findMasterEditionPda } from '@metaplex-foundation/mpl-token-metadata';

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const connection = new Connection(RPC);
const umi = createUmi(RPC);

const collectionMint = publicKey('F2oFksfgM7JxaMSnH8EAPC2fkejSiNFqh4e27BpAAKLa');
const itemMint = publicKey('doza2rn8i1JLH6GfRFy9uinGF3N3Bo2gV4Pi8c1tV1L');

async function ownerOf(pk: PublicKey) {
  const info = await connection.getAccountInfo(pk);
  return info ? info.owner.toBase58() : null;
}

(async () => {
  const itemMdPda = findMetadataPda(umi, { mint: itemMint })[0];
  const colMdPda  = findMetadataPda(umi, { mint: collectionMint })[0];
  const colMePda  = findMasterEditionPda(umi, { mint: collectionMint })[0];

  console.log('Item Metadata PDA:', itemMdPda.toString());
  console.log('Collection Metadata PDA:', colMdPda.toString());
  console.log('Collection MasterEdition PDA:', colMePda.toString());

  console.log('\nOwners (should be Token Metadata program):');
  console.log(' itemMetadata.owner       =', await ownerOf(new PublicKey(itemMdPda)));
  console.log(' collectionMetadata.owner =', await ownerOf(new PublicKey(colMdPda)));
  console.log(' collectionMasterEd.owner =', await ownerOf(new PublicKey(colMePda)));

  console.log('\nMint owners (should be SPL Token program):');
  console.log(' itemMint.owner           =', await ownerOf(new PublicKey(itemMint)));
  console.log(' collectionMint.owner     =', await ownerOf(new PublicKey(collectionMint)));
})();

