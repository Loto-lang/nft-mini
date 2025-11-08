// Node script to generate Metaplex-like metadata with verbose logging
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const META_DIR = path.join(ROOT, "metadata");

function toTitle(base) {
  const name = base.replace(/\.[^/.]+$/, "");
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function main() {
  console.log("[INFO] ROOT:", ROOT);
  console.log("[INFO] ASSETS_DIR:", ASSETS_DIR);
  console.log("[INFO] META_DIR:", META_DIR);

  if (!fs.existsSync(ASSETS_DIR)) {
    console.error("[ERROR] assets/ folder not found. Expected at:", ASSETS_DIR);
    process.exit(1);
  }
  if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });

  const files = fs.readdirSync(ASSETS_DIR).filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
  console.log("[INFO] Found image files:", files);

  if (files.length === 0) {
    console.error("[ERROR] No image files found in assets/. Supported: png, jpg, jpeg, gif");
    process.exit(1);
  }

  const placeholderBaseUri = "ipfs://<REPLACE_WITH_YOUR_CID>/";

  let created = 0;
  files.forEach((file, idx) => {
    const name = toTitle(file);
    const imageUri = placeholderBaseUri + encodeURIComponent(file);

    const data = {
      name,
      symbol: "MNFT",
      description: `Mini NFT #${idx + 1} for the bootcamp.`,
      image: imageUri,
      attributes: [
        { trait_type: "Edition", value: idx + 1 },
        { trait_type: "Set", value: "MiniBootcamp" }
      ],
      properties: {
        files: [{ uri: imageUri, type: "image/png" }],
        category: "image"
      }
    };

    const out = path.join(META_DIR, file.replace(/\.[^/.]+$/, ".json"));
    fs.writeFileSync(out, JSON.stringify(data, null, 2));
    console.log("[OK] Wrote:", out);
    created++;
  });

  console.log(`[DONE] Generated ${created} metadata files in metadata/`);
}

main();
