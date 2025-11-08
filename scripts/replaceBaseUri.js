// Replace placeholder base URI in all metadata/*.json
// Usage: node scripts/replaceBaseUri.js ipfs://<CID>/

const fs = require("fs");
const path = require("path");

const base = process.argv[2];
if (!base || !base.startsWith("ipfs://")) {
  console.error("Usage: node scripts/replaceBaseUri.js ipfs://<CID>/");
  process.exit(1);
}
const META_DIR = path.join(__dirname, "..", "metadata");
const files = fs.readdirSync(META_DIR).filter(f => f.endsWith(".json"));

for (const f of files) {
  const p = path.join(META_DIR, f);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  // Replace image + properties.files[0].uri
  const filename = f.replace(/\.json$/, ".png"); // adjust if your images are .jpg
  j.image = `${base}${encodeURIComponent(filename)}`;
  if (j.properties?.files?.[0]) {
    j.properties.files[0].uri = j.image;
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  console.log("Updated:", f);
}
console.log("Done.");
