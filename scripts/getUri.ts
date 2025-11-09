// Usage: npx ts-node scripts/getUri.ts <MINT_ADDRESS>
// Reads on-chain token-metadata (Metaplex) and prints the json_uri.

// --- Imports
import { Connection, PublicKey } from "@solana/web3.js";

// Token Metadata Program ID (well-known address)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// PDA derivation for metadata account
function findMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

async function main() {
  const mintArg = process.argv[2];
  if (!mintArg) {
    console.error("Usage: npx ts-node scripts/getUri.ts <MINT_ADDRESS>");
    process.exit(1);
  }

  // RPC resolution (env first, then devnet)
  const RPC =
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC ||
    process.env.ALCHEMY_RPC ||
    "https://api.devnet.solana.com";

  const connection = new Connection(RPC, "confirmed");
  const mint = new PublicKey(mintArg);
  const metadataPda = findMetadataPda(mint);

  const accInfo = await connection.getAccountInfo(metadataPda);
  if (!accInfo) {
    console.log("No metadata account found for this mint.");
    return;
  }

  // --- Minimal deserializer to extract the URI from Token Metadata v1 layout.
  // The URI sits in the Metadata 'data' struct as a Rust string (name, symbol, uri, ...).
  // We parse it by scanning for the third Rust string after the fixed header.

  // Helper: read Rust string <len:u32 little endian><bytes>
  const readRustString = (buf: Buffer, offset: number) => {
    const len = buf.readUInt32LE(offset);
    const start = offset + 4;
    const end = start + len;
    const str = buf.slice(start, end).toString("utf8");
    return { str, next: end };
  };

  // Skip fixed header (key + updateAuth + mint + name + symbol)
  // Layout (v1):
  //   key: u8
  //   update_authority: Pubkey (32)
  //   mint: Pubkey (32)
  //   name: RustString
  //   symbol: RustString
  //   uri: RustString  <-- we want this
  // We’ll read sequentially and stop at the 3rd string.
  let o = 0;
  const data = Buffer.from(accInfo.data);

  // key + two pubkeys
  o += 1;            // key
  o += 32;           // update_authority
  o += 32;           // mint

  // name
  const nameRes = readRustString(data, o);
  o = nameRes.next;

  // symbol
  const symbolRes = readRustString(data, o);
  o = symbolRes.next;

  // uri
  const uriRes = readRustString(data, o);
  const uri = uriRes.str.trim();

  console.log(`Metadata PDA: ${metadataPda.toBase58()}`);
  console.log(`Current on-chain json_uri: ${uri || "(empty)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
