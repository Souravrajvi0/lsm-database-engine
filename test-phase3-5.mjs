// PHASE 3-5: Compaction, Bloom Filters, and Concurrency
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:5000';

// ============================================================
// PHASE 3: COMPACTION CORRECTNESS
// ============================================================
async function phase3CompactionCorrectness() {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 3: COMPACTION CORRECTNESS');
    console.log('='.repeat(60));

    const results = {
        keysBeforeCompaction: 0,
        keysAfterCompaction: 0,
        duplicates: [],
        dataLoss: [],
        l0FilesBefore: 0,
        l0FilesAfter: 0,
        l1FilesBefore: 0,
        l1FilesAfter: 0
    };

    try {
        // Insert data to force at least 4 L0 SSTables
        console.log('\n[1/4] Inserting 300 keys to force L0 SSTables...');
        const keys = [];
        for (let i = 0; i < 300; i++) {
            const key = `compact_test_${i}`;
            keys.push(key);
            await fetch(`${BASE_URL}/api/lsm/put`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: `value_${i}` })
            });
        }
        console.log(`✓ Inserted 300 keys`);

        // Wait for flushes
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get stats before compaction
        let stats = await fetch(`${BASE_URL}/api/lsm/stats`).then(r => r.json());
        results.l0FilesBefore = stats.levels.find(l => l.level === 0)?.fileCount || 0;
        results.l1FilesBefore = stats.levels.find(l => l.level === 1)?.fileCount || 0;
        console.log(`\n[2/4] Before compaction:`);
        console.log(`  L0 files: ${results.l0FilesBefore}`);
        console.log(`  L1 files: ${results.l1FilesBefore}`);

        // Verify all keys before compaction
        for (const key of keys) {
            const res = await fetch(`${BASE_URL}/api/lsm/key/${key}`);
            const data = await res.json();
            if (data.value !== null) results.keysBeforeCompaction++;
        }
        console.log(`  Keys readable: ${results.keysBeforeCompaction}/300`);

        // Trigger compaction
        console.log('\n[3/4] Triggering compaction...');
        await fetch(`${BASE_URL}/api/lsm/compact`, { method: 'POST' });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for compaction

        // Get stats after compaction
        stats = await fetch(`${BASE_URL}/api/lsm/stats`).then(r => r.json());
        results.l0FilesAfter = stats.levels.find(l => l.level === 0)?.fileCount || 0;
        results.l1FilesAfter = stats.levels.find(l => l.level === 1)?.fileCount || 0;
        console.log(`  After compaction:`);
        console.log(`  L0 files: ${results.l0FilesAfter}`);
        console.log(`  L1 files: ${results.l1FilesAfter}`);

        // Verify all keys after compaction
        console.log('\n[4/4] Verifying data integrity after compaction...');
        for (const key of keys) {
            const res = await fetch(`${BASE_URL}/api/lsm/key/${key}`);
            const data = await res.json();
            if (data.value !== null) {
                results.keysAfterCompaction++;
            } else {
                results.dataLoss.push(key);
            }
        }
        console.log(`  Keys readable: ${results.keysAfterCompaction}/300`);

    } catch (error) {
        console.error('Fatal error:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('PHASE 3 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Keys before compaction: ${results.keysBeforeCompaction}/300`);
    console.log(`Keys after compaction:  ${results.keysAfterCompaction}/300`);
    console.log(`Data loss:              ${results.dataLoss.length}`);
    console.log(`L0 files: ${results.l0FilesBefore} → ${results.l0FilesAfter}`);
    console.log(`L1 files: ${results.l1FilesBefore} → ${results.l1FilesAfter}`);

    const verdict = results.keysAfterCompaction === results.keysBeforeCompaction &&
        results.dataLoss.length === 0;
    console.log(`\n✓ VERDICT: ${verdict ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(60));

    return results;
}

// ============================================================
// PHASE 4: BLOOM FILTER EFFECTIVENESS
// ============================================================
async function phase4BloomFilterEffectiveness() {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 4: BLOOM FILTER EFFECTIVENESS');
    console.log('='.repeat(60));

    const results = {
        existingKeysRead: 0,
        nonExistentKeysRead: 0,
        bloomHitsBefore: 0,
        bloomMissesBefore: 0,
        bloomHitsAfter: 0,
        bloomMissesAfter: 0,
        efficiencyBefore: 0,
        efficiencyAfter: 0
    };

    try {
        // Get initial bloom stats
        let stats = await fetch(`${BASE_URL}/api/lsm/stats`).then(r => r.json());
        results.bloomHitsBefore = stats.metrics.bloomFilterHits || 0;
        results.bloomMissesBefore = stats.metrics.bloomFilterMisses || 0;

        console.log('\n[1/3] Initial bloom filter stats:');
        console.log(`  Hits: ${results.bloomHitsBefore}`);
        console.log(`  Misses: ${results.bloomMissesBefore}`);

        // Read 100 EXISTING keys (from previous tests)
        console.log('\n[2/3] Reading 100 EXISTING keys...');
        for (let i = 0; i < 100; i++) {
            await fetch(`${BASE_URL}/api/lsm/key/compact_test_${i}`);
            results.existingKeysRead++;
        }

        // Read 100 NON-EXISTENT keys
        console.log('\n[3/3] Reading 100 NON-EXISTENT keys...');
        for (let i = 0; i < 100; i++) {
            await fetch(`${BASE_URL}/api/lsm/key/nonexistent_key_${i}`);
            results.nonExistentKeysRead++;
        }

        // Get final bloom stats
        stats = await fetch(`${BASE_URL}/api/lsm/stats`).then(r => r.json());
        results.bloomHitsAfter = stats.metrics.bloomFilterHits || 0;
        results.bloomMissesAfter = stats.metrics.bloomFilterMisses || 0;

        const totalChecks = (results.bloomHitsAfter + results.bloomMissesAfter) -
            (results.bloomHitsBefore + results.bloomMissesBefore);
        const hits = results.bloomHitsAfter - results.bloomHitsBefore;
        const misses = results.bloomMissesAfter - results.bloomMissesBefore;

        results.efficiencyAfter = totalChecks > 0 ? (hits / totalChecks * 100) : 0;

    } catch (error) {
        console.error('Fatal error:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('PHASE 4 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Existing keys read:     ${results.existingKeysRead}`);
    console.log(`Non-existent keys read: ${results.nonExistentKeysRead}`);
    console.log(`Bloom hits:  ${results.bloomHitsBefore} → ${results.bloomHitsAfter} (+${results.bloomHitsAfter - results.bloomHitsBefore})`);
    console.log(`Bloom misses: ${results.bloomMissesBefore} → ${results.bloomMissesAfter} (+${results.bloomMissesAfter - results.bloomMissesBefore})`);
    console.log(`Efficiency: ${results.efficiencyAfter.toFixed(2)}%`);

    console.log('\n✓ INTERPRETATION:');
    console.log(`  - Bloom filter should have HIGH hits for existing keys`);
    console.log(`  - Bloom filter should have HIGH misses for non-existent keys`);
    console.log(`  - Efficiency represents how often bloom filter correctly identifies "maybe exists"`);

    console.log('\n✓ VERDICT: INFORMATIONAL (no pass/fail criteria)');
    console.log('='.repeat(60));

    return results;
}

// ============================================================
// PHASE 5: CONCURRENCY & RACE CONDITIONS
// ============================================================
async function phase5ConcurrencyTest() {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 5: CONCURRENCY & RACE CONDITIONS');
    console.log('='.repeat(60));

    const results = {
        parallelWrites: 0,
        parallelReads: 0,
        errors: [],
        keysLost: [],
        keysDuplicated: [],
        crashes: 0
    };

    try {
        console.log('\n[1/3] Running 50 parallel writes...');
        const writePromises = [];
        for (let i = 0; i < 50; i++) {
            writePromises.push(
                fetch(`${BASE_URL}/api/lsm/put`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: `concurrent_${i}`, value: `value_${i}` })
                }).then(res => {
                    if (res.ok) results.parallelWrites++;
                    else results.errors.push(`Write ${i} failed: ${res.status}`);
                }).catch(e => {
                    results.errors.push(`Write ${i} error: ${e.message}`);
                })
            );
        }
        await Promise.all(writePromises);
        console.log(`✓ Parallel writes completed: ${results.parallelWrites}/50`);

        console.log('\n[2/3] Running 50 parallel reads...');
        const readPromises = [];
        for (let i = 0; i < 50; i++) {
            readPromises.push(
                fetch(`${BASE_URL}/api/lsm/key/concurrent_${i}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.value !== null) results.parallelReads++;
                        else results.keysLost.push(`concurrent_${i}`);
                    })
                    .catch(e => {
                        results.errors.push(`Read ${i} error: ${e.message}`);
                    })
            );
        }
        await Promise.all(readPromises);
        console.log(`✓ Parallel reads completed: ${results.parallelReads}/50`);

        console.log('\n[3/3] Checking for race condition symptoms...');
        console.log(`  Errors: ${results.errors.length}`);
        console.log(`  Keys lost: ${results.keysLost.length}`);

    } catch (error) {
        console.error('Fatal error:', error);
        results.crashes++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('PHASE 5 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Parallel writes: ${results.parallelWrites}/50`);
    console.log(`Parallel reads:  ${results.parallelReads}/50`);
    console.log(`Errors:          ${results.errors.length}`);
    console.log(`Keys lost:       ${results.keysLost.length}`);
    console.log(`Crashes:         ${results.crashes}`);

    if (results.errors.length > 0) {
        console.log('\nERRORS:');
        results.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    }

    const verdict = results.parallelWrites === 50 &&
        results.parallelReads === 50 &&
        results.errors.length === 0;

    console.log(`\n✓ VERDICT: ${verdict ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(60));

    return results;
}

// ============================================================
// RUN ALL PHASES
// ============================================================
async function runPhases3to5() {
    await phase3CompactionCorrectness();
    await phase4BloomFilterEffectiveness();
    await phase5ConcurrencyTest();
}

runPhases3to5().catch(console.error);
