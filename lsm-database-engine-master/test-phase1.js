// PHASE 1: Basic Correctness Tests
const BASE_URL = 'http://localhost:5000';

async function phase1BasicCorrectness() {
    console.log('='.repeat(60));
    console.log('PHASE 1: BASIC CORRECTNESS TESTS');
    console.log('='.repeat(60));

    const results = {
        successfulWrites: 0,
        successfulReads: 0,
        successfulUpdates: 0,
        successfulDeletes: 0,
        mismatches: [],
        errors: []
    };

    try {
        // Step 1: Insert 100 unique key-value pairs
        console.log('\n[1/5] Inserting 100 unique key-value pairs...');
        for (let i = 0; i < 100; i++) {
            try {
                const res = await fetch(`${BASE_URL}/api/lsm/put`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: `test_key_${i}`, value: `test_value_${i}` })
                });
                if (res.ok) results.successfulWrites++;
                else results.errors.push(`Write failed for key ${i}: ${res.status}`);
            } catch (e) {
                results.errors.push(`Write error for key ${i}: ${e.message}`);
            }
        }
        console.log(`✓ Successful writes: ${results.successfulWrites}/100`);

        // Step 2: Read all 100 keys
        console.log('\n[2/5] Reading all 100 keys...');
        for (let i = 0; i < 100; i++) {
            try {
                const res = await fetch(`${BASE_URL}/api/lsm/key/test_key_${i}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.value === `test_value_${i}`) {
                        results.successfulReads++;
                    } else {
                        results.mismatches.push(`Key ${i}: expected test_value_${i}, got ${data.value}`);
                    }
                } else {
                    results.errors.push(`Read failed for key ${i}: ${res.status}`);
                }
            } catch (e) {
                results.errors.push(`Read error for key ${i}: ${e.message}`);
            }
        }
        console.log(`✓ Successful reads: ${results.successfulReads}/100`);

        // Step 3: Update 50 keys
        console.log('\n[3/5] Updating 50 keys (0-49)...');
        for (let i = 0; i < 50; i++) {
            try {
                const res = await fetch(`${BASE_URL}/api/lsm/put`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: `test_key_${i}`, value: `updated_value_${i}` })
                });
                if (res.ok) results.successfulUpdates++;
                else results.errors.push(`Update failed for key ${i}: ${res.status}`);
            } catch (e) {
                results.errors.push(`Update error for key ${i}: ${e.message}`);
            }
        }
        console.log(`✓ Successful updates: ${results.successfulUpdates}/50`);

        // Step 4: Delete 25 keys
        console.log('\n[4/5] Deleting 25 keys (0-24)...');
        for (let i = 0; i < 25; i++) {
            try {
                const res = await fetch(`${BASE_URL}/api/lsm/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: `test_key_${i}` })
                });
                if (res.ok) results.successfulDeletes++;
                else results.errors.push(`Delete failed for key ${i}: ${res.status}`);
            } catch (e) {
                results.errors.push(`Delete error for key ${i}: ${e.message}`);
            }
        }
        console.log(`✓ Successful deletes: ${results.successfulDeletes}/25`);

        // Step 5: Verify correctness
        console.log('\n[5/5] Verifying correctness...');

        // Verify deleted keys return null
        let deletedCorrect = 0;
        for (let i = 0; i < 25; i++) {
            const res = await fetch(`${BASE_URL}/api/lsm/key/test_key_${i}`);
            const data = await res.json();
            if (data.value === null) deletedCorrect++;
            else results.mismatches.push(`Deleted key ${i} returned: ${data.value}`);
        }
        console.log(`  Deleted keys (0-24) return null: ${deletedCorrect}/25`);

        // Verify updated keys return latest values
        let updatedCorrect = 0;
        for (let i = 25; i < 50; i++) {
            const res = await fetch(`${BASE_URL}/api/lsm/key/test_key_${i}`);
            const data = await res.json();
            if (data.value === `updated_value_${i}`) updatedCorrect++;
            else results.mismatches.push(`Updated key ${i}: expected updated_value_${i}, got ${data.value}`);
        }
        console.log(`  Updated keys (25-49) have latest values: ${updatedCorrect}/25`);

        // Verify non-deleted keys are intact
        let intactCorrect = 0;
        for (let i = 50; i < 100; i++) {
            const res = await fetch(`${BASE_URL}/api/lsm/key/test_key_${i}`);
            const data = await res.json();
            if (data.value === `test_value_${i}`) intactCorrect++;
            else results.mismatches.push(`Intact key ${i}: expected test_value_${i}, got ${data.value}`);
        }
        console.log(`  Non-deleted keys (50-99) are intact: ${intactCorrect}/50`);

    } catch (error) {
        console.error('Fatal error:', error);
        results.errors.push(`Fatal: ${error.message}`);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 1 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Successful writes:  ${results.successfulWrites}/100`);
    console.log(`Successful reads:   ${results.successfulReads}/100`);
    console.log(`Successful updates: ${results.successfulUpdates}/50`);
    console.log(`Successful deletes: ${results.successfulDeletes}/25`);
    console.log(`Mismatches:         ${results.mismatches.length}`);
    console.log(`Errors:             ${results.errors.length}`);

    if (results.mismatches.length > 0) {
        console.log('\nMISMATCHES:');
        results.mismatches.slice(0, 10).forEach(m => console.log(`  - ${m}`));
        if (results.mismatches.length > 10) console.log(`  ... and ${results.mismatches.length - 10} more`);
    }

    if (results.errors.length > 0) {
        console.log('\nERRORS:');
        results.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
        if (results.errors.length > 10) console.log(`  ... and ${results.errors.length - 10} more`);
    }

    const verdict = results.successfulWrites === 100 &&
        results.successfulReads === 100 &&
        results.mismatches.length === 0 &&
        results.errors.length === 0;

    console.log(`\n✓ VERDICT: ${verdict ? 'PASS' : 'FAIL'}`);
    console.log('='.repeat(60) + '\n');

    return results;
}

phase1BasicCorrectness().catch(console.error);
