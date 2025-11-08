// scripts/auditCollectionConsistency.ts
// Run: npx ts-node --files scripts/auditCollectionConsistency.ts <collectionMint> <expectedCID> "<namePrefix>" "<SYMBOL>" <royaltiesBps> <creatorPubkey>

export {}; // Make this file a module to avoid variable redeclaration errors

const RPC = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';

const [
  collectionMint,
  expectedCID,
  namePrefix,
  symbol,
  royaltiesStr,
  creatorPk,
] = process.argv.slice(2);

const royaltiesBps = Number(royaltiesStr);

if (
  !collectionMint ||
  !expectedCID ||
  !namePrefix ||
  !symbol ||
  !Number.isFinite(royaltiesBps) ||
  !creatorPk
) {
  console.error(
    'Usage: npx ts-node --files scripts/auditCollectionConsistency.ts <collectionMint> <expectedCID> "<namePrefix>" "<SYMBOL>" <royaltiesBps> <creatorPubkey>'
  );
  process.exit(1);
}

function startsWithIpfs(u?: string) {
  return !!u && (u.startsWith('ipfs://') || u.includes('/ipfs/'));
}

async function getAllByGroup(groupKey: string, groupValue: string) {
  const out: any[] = [];
  let page = 1;
  console.log(`\n[Fetching] Starting to fetch items for collection: ${groupValue}`);
  for (;;) {
    console.log(`[Fetching] Requesting page ${page}...`);
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
    if (!j?.result) {
      console.error('RPC error:', JSON.stringify(j));
      break;
    }
    const items = j.result.items ?? [];
    console.log(`[Fetching] Page ${page}: received ${items.length} items (total so far: ${out.length + items.length})`);
    out.push(...items);
    if (items.length < 1000) {
      console.log(`[Fetching] Completed: fetched all ${out.length} items across ${page} page(s)\n`);
      break;
    }
    page++;
  }
  return out;
}

(async () => {
  if (!RPC || RPC.includes('YOUR_KEY')) {
    throw new Error('SOLANA_RPC missing or invalid. Set a valid Helius DAS URL.');
  }

  console.log('='.repeat(70));
  console.log('Collection Consistency Audit');
  console.log('='.repeat(70));
  console.log(`Collection Mint: ${collectionMint}`);
  console.log(`Expected CID: ${expectedCID}`);
  console.log(`Name Prefix: "${namePrefix}"`);
  console.log(`Symbol: "${symbol}"`);
  console.log(`Royalties: ${royaltiesBps} bps`);
  console.log(`Creator: ${creatorPk}`);
  console.log(`RPC Endpoint: ${RPC}`);
  console.log('='.repeat(70));

  const items = await getAllByGroup('collection', collectionMint);
  
  console.log('[Audit] Starting consistency checks...');
  console.log(`[Audit] Processing ${items.length} items...\n`);

  const problems: Array<{ mint: string; issues: string[] }> = [];
  let verifiedOk = 0,
    verifiedKo = 0;
  
  let checkedCount = 0;
  const checkInterval = Math.max(1, Math.floor(items.length / 10)); // Progress every 10%

  for (const it of items) {
    checkedCount++;
    if (checkedCount % checkInterval === 0 || checkedCount === items.length) {
      const progress = ((checkedCount / items.length) * 100).toFixed(1);
      console.log(`[Audit] Progress: ${checkedCount}/${items.length} (${progress}%)`);
    }
    const mint = (it.id || it.asset_id) as string;
    const issues: string[] = [];

    // 1) Collection verification flag (DAS grouping)
    const group = (it.grouping || []).find(
      (g: any) => g.group_key === 'collection'
    );
    const isVerified = group?.verified === true;
    if (isVerified) verifiedOk++;
    else {
      verifiedKo++;
      issues.push('collection not verified');
    }

    // 2) Token standard heuristic (should be NonFungible)
    const ts = it?.token_info?.token_standard ?? it?.interface;
    if (ts && !String(ts).toLowerCase().includes('non')) {
      issues.push(`tokenStandard suspicious: ${ts}`);
    }

    // 3) Symbol
    const sym = it?.content?.metadata?.symbol ?? it?.content?.json?.symbol;
    if (sym !== symbol) issues.push(`symbol mismatch: ${sym}`);

    // 4) Name prefix
    const name = it?.content?.metadata?.name ?? it?.content?.json?.name;
    if (!name?.startsWith(namePrefix)) issues.push(`name mismatch: ${name}`);

    // 5) Royalties (bps)
    const bps =
      it?.royalty?.basis_points ?? it?.content?.metadata?.seller_fee_basis_points;
    if (bps !== royaltiesBps) issues.push(`royalties bps mismatch: ${bps}`);

    // 6) Creator presence/verification
    const creators = it?.royalty?.creators ?? it?.content?.metadata?.creators;
    const foundCreator =
      Array.isArray(creators) &&
      creators.some(
        (c: any) =>
          (c.address ?? c.addresses?.[0]) === creatorPk &&
          (c.verified === true || c.share === 100)
      );
    if (!foundCreator) issues.push('expected creator not present/verified');

    // 7) URI / CID checks
    const jsonUri = it?.content?.json_uri as string | undefined;
    const imageUri = it?.content?.links?.image as string | undefined;
    const okJsonCid = !!jsonUri && jsonUri.includes(expectedCID);
    const okImageCid = !imageUri || imageUri.includes(expectedCID);
    const okIpfs = startsWithIpfs(jsonUri);

    if (!okJsonCid) issues.push(`json_uri CID mismatch: ${jsonUri}`);
    if (!okIpfs) issues.push(`json_uri not ipfs-like: ${jsonUri}`);
    if (!okImageCid) issues.push(`image CID mismatch: ${imageUri}`);

    if (issues.length) problems.push({ mint, issues });
  }

  console.log('\n' + '='.repeat(70));
  console.log('[Results]');
  console.log('='.repeat(70));
  
  // Verification status
  console.log('\n[Verification Status]');
  console.log(`  Verified: ${verifiedOk}`);
  console.log(`  Not Verified: ${verifiedKo}`);
  console.log(`  Verification Rate: ${items.length > 0 ? ((verifiedOk / items.length) * 100).toFixed(2) : 0}%`);

  // Consistency check results
  console.log('\n[Consistency Check]');
  const consistentCount = items.length - problems.length;
  const consistencyRate = items.length > 0 ? ((consistentCount / items.length) * 100).toFixed(2) : 0;
  console.log(`  Consistent Items: ${consistentCount}/${items.length} (${consistencyRate}%)`);
  console.log(`  Items with Issues: ${problems.length}/${items.length}`);

  if (problems.length === 0) {
    console.log('\n✅ Collection is fully consistent!');
    console.log('   All items pass: verification, symbol, name prefix, royalties, creators, and URI checks.');
  } else {
    console.log(`\n⚠️  Found ${problems.length} inconsistent items:`);
    console.log('\n[Issues Breakdown]');
    
    // Count issue types
    const issueTypes: Record<string, number> = {};
    for (const p of problems) {
      for (const issue of p.issues) {
        const issueType = issue.split(':')[0] || issue;
        issueTypes[issueType] = (issueTypes[issueType] || 0) + 1;
      }
    }
    
    console.log('  Issue frequency:');
    for (const [type, count] of Object.entries(issueTypes).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type}: ${count}`);
    }
    
    console.log('\n[Detailed Issues]');
    for (const p of problems) {
      console.log(`  • ${p.mint}`);
      for (const issue of p.issues) {
        console.log(`    - ${issue}`);
      }
    }
    process.exitCode = 1;
  }

  console.log('\n' + '='.repeat(70));
  console.log('Audit Complete');
  console.log('='.repeat(70));
})();

