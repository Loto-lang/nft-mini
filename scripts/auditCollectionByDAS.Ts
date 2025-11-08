// scripts/auditCollectionByDAS.ts
// Run: npx ts-node --files scripts/auditCollectionByDAS.ts <collectionMint> [expectedCount]

// Use native fetch from Node >= 18 (no import needed)
const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const [collectionMint, expectedStr] = process.argv.slice(2);
const expectedCount = expectedStr ? parseInt(expectedStr, 10) : undefined;

if (!collectionMint) {
  console.error('Usage: npx ts-node --files scripts/auditCollectionByDAS.ts <collectionMint> [expectedCount]');
  process.exit(1);
}

async function getAllByGroup(groupKey: string, groupValue: string) {
  const out: any[] = [];
  let page = 1;
  while (true) {
    const body = {
      jsonrpc: '2.0',
      id: 'audit',
      method: 'getAssetsByGroup',
      params: {
        groupKey,
        groupValue,
        page,
        limit: 1000,
        sortBy: { sortBy: 'created', sortDirection: 'asc' },
      },
    };
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    const items = j?.result?.items ?? [];
    out.push(...items);
    if (items.length < 1000) break;
    page += 1;
  }
  return out;
}

(async () => {
  const items = await getAllByGroup('collection', collectionMint);
  console.log('Found items:', items.length);

  if (expectedCount !== undefined) {
    console.log('Expected count:', expectedCount, '—', expectedCount === items.length ? 'OK' : 'MISMATCH');
  }

  let verifiedOk = 0, verifiedKo = 0;
  for (const it of items) {
    const group = (it.grouping || []).find((g: any) => g.group_key === 'collection');
    const isVerified = group?.verified === true; // DAS flag for collection verification
    if (isVerified) verifiedOk++; else verifiedKo++;
  }
  console.log('Verified OK:', verifiedOk, 'Verified KO:', verifiedKo);
})();

