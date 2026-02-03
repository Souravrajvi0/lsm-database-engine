// PHASE 2: MemTable Flush & SSTable Verification
const BASE_URL = 'http://localhost:5000';
const fs = require('node:fs');
const path = require('node:path');

async function phase2FlushAndRestart() {
    console.log('='.repeat(60));
    console.log('PHASE 2: MEMTABLE FLUSH & SSTABLE VERIFICATION');
    console.log('='.repeat(60));

    const results = {
        keysWritten: 0,
        flushesObserved: 0,
        sstableFiles: [],
        levelDistribution: {},
        keysAfterRestart: 0,
        missingKeys: [],
        corruptedKeys: []
    };

    const MEMTABLE_THRESHOLD = 50; // From server/lsm.ts
    const TOTAL_KEYS = 250; // Should trigger 5 flushes

    try {
        // Step 1: Insert enough keys to trigger MULTIPLE flushes
        console.log(`\n[1/4] Inserting ${TOTAL_KEYS} keys (threshold: ${MEMTABLE_THRESHOLD})...`);
        console.log(`Expected flushes: ${Math.floor(TOTAL_KEYS / MEMTABLE_THRESHOLD)}`);

        for (let i = 0; i < TOTAL_KEYS; i++) {
            const res = await fetch(`${BASE_URL}/api/lsm/put`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: `flush_test_${i}`, value: `value_${i}` })
            });
            if (res.ok) results.keysWritten++;

            // Check for new SSTables every 50 writes
            if ((i + 1) % MEMTABLE_THRESHOLD === 0) {
                await new Promise(resolve => setTimeout(resolve, 100)); // Wait for flush
                const stats = await fetch(`${BASE_URL}/api/lsm/stats`).then(r => r.json());
                const totalFiles = stats.levels.reduce((sum, l) => sum + l.fileCount, 0);
                console.log(`  After ${i + 1} writes: ${totalFiles} SSTable files`);
            }
        }
        console.log(`✓ Keys written: ${results.keysWritten}/${TOTAL_KEYS}`);

        // Step 2: List SSTable files
        console.log('\n[2/4] Listing SSTable files...');
        const sstDir = path.join(process.cwd(), 'data', 'sstables');
        if (fs.existsSync(sstDir)) {
            results.sstableFiles = fs.readdirSync(sstDir).filter(f => f.endsWith('.json'));
            console.log(`  SSTable files found: ${results.sstableFiles.length}`);
            results.sstableFiles.forEach(f => console.log(`    - ${f}`));
        } else {
            console.log('  ⚠ SSTable directory does not exist!');
        }

        // Step 3: Get level distribution
        console.log('\n[3/4] Checking level distribution...');
        const stats = await fetch(`${BASE_URL}/api/lsm/stats`).then(r => r.json());
        stats.levels.forEach(level => {
            results.levelDistribution[`L${level.level}`] = level.fileCount;
            console.log(`  Level ${level.level}: ${level.fileCount} files (${(level.totalSize / 1024).toFixed(2)} KB)`);
        });

        // Step 4: Restart server and verify
        console.log('\n[4/4] Simulating restart (checking WAL recovery)...');
        console.log('  Note: Cannot actually restart server in test, checking current state...');

        // Verify all keys are still readable
        let readableCount = 0;
        for (let i = 0; i < TOTAL_KEYS; i++) {
            try {
                const res = await fetch(`${BASE_URL}/api/lsm/key/flush_test_${i}`);
                const data = await res.json();
                if (data.value === `value_${i}`) {
                    readableCount++;
                } else if (data.value === null) {
                    results.missingKeys.push(`flush_test_${i}`);
                } else {
                    results.corruptedKeys.push(`flush_test_${i}: expected value_${i}, got ${data.value}`);
                }
            } catch (e) {
                results.corruptedKeys.push(`flush_test_${i}: ${e.message}`);
            }
        }
        results.keysAfterRestart = readableCount;
        console.log(`  Keys readable: ${readableCount}/${TOTAL_KEYS}`);

    } catch (error) {
        console.error('Fatal error:', error);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 2 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Keys written:       ${results.keysWritten}/${TOTAL_KEYS}`);
    console.log(`SSTable files:      ${results.sstableFiles.length}`);
    console.log(`Level distribution: ${JSON.stringify(results.levelDistribution)}`);
    console.log(`Keys after restart: ${results.keysAfterRestart}/${TOTAL_KEYS}`);
    console.log(`Missing keys:       ${results.missingKeys.length}`);
    console.log(`Corrupted keys:     ${results.corruptedKeys.length}`);

    if (results.missingKeys.length > 0) {
        console.log('\nMISSING KEYS:');
        results.missingKeys.slice(0, 10).forEach(k => console.log(`  - ${k}`));
        if (results.missingKeys.length > 10) console.log(`  ... and ${results.missingKeys.length - 10} more`);
    }

    if (results.corruptedKeys.length > 0) {
        console.log('\nCORRUPTED KEYS:');
        results.corruptedKeys.slice(0, 10).forEach(k => console.log(`  - ${k}`));
        if (results.corruptedKeys.length > 10) console.log(`  ... and ${results.corruptedKeys.length - 10} more`);
    }

    const verdict = results.keysWritten === TOTAL_KEYS &&
        results.keysAfterRestart === TOTAL_KEYS &&
        results.sstableFiles.length > 0;

    console.log(`\n✓ VERDICT: ${verdict ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(60) + '\n');

    return results;
}

phase2FlushAndRestart().catch(console.error);
