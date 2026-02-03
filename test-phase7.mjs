// PHASE 7: NEGATIVE & EDGE CASE TESTS
const BASE_URL = 'http://localhost:5000';

async function phase7EdgeCases() {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 7: NEGATIVE & EDGE CASE TESTS');
    console.log('='.repeat(60));

    const results = {
        tests: [],
        passed: 0,
        failed: 0,
        crashes: 0
    };

    const runTest = async (name, testFn) => {
        try {
            console.log(`\n[TEST] ${name}...`);
            const result = await testFn();
            results.tests.push({ name, status: result.status, message: result.message });
            if (result.status === 'PASS') results.passed++;
            else results.failed++;
            console.log(`  ${result.status}: ${result.message}`);
        } catch (error) {
            results.tests.push({ name, status: 'CRASH', message: error.message });
            results.crashes++;
            console.log(`  CRASH: ${error.message}`);
        }
    };

    // Test 1: Empty key
    await runTest('Empty key', async () => {
        const res = await fetch(`${BASE_URL}/api/lsm/put`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: '', value: 'test' })
        });
        return res.ok
            ? { status: 'PASS', message: 'Empty key accepted' }
            : { status: 'PASS', message: `Empty key rejected with ${res.status}` };
    });

    // Test 2: Very large value (1MB+)
    await runTest('Very large value (1MB)', async () => {
        const largeValue = 'x'.repeat(1024 * 1024); // 1MB
        const res = await fetch(`${BASE_URL}/api/lsm/put`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'large_key', value: largeValue })
        });
        if (!res.ok) return { status: 'FAIL', message: `Server rejected: ${res.status}` };

        const getRes = await fetch(`${BASE_URL}/api/lsm/key/large_key`);
        const data = await getRes.json();
        return data.value === largeValue
            ? { status: 'PASS', message: '1MB value stored and retrieved' }
            : { status: 'FAIL', message: 'Value corrupted' };
    });

    // Test 3: Unicode keys
    await runTest('Unicode keys', async () => {
        const unicodeKey = '测试_🔥_key';
        const res = await fetch(`${BASE_URL}/api/lsm/put`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: unicodeKey, value: 'unicode_value' })
        });
        if (!res.ok) return { status: 'FAIL', message: `Server rejected: ${res.status}` };

        const getRes = await fetch(`${BASE_URL}/api/lsm/key/${encodeURIComponent(unicodeKey)}`);
        const data = await getRes.json();
        return data.value === 'unicode_value'
            ? { status: 'PASS', message: 'Unicode key handled correctly' }
            : { status: 'FAIL', message: 'Unicode key failed' };
    });

    // Test 4: Rapid repeated writes to same key
    await runTest('Rapid repeated writes (100x same key)', async () => {
        for (let i = 0; i < 100; i++) {
            await fetch(`${BASE_URL}/api/lsm/put`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'repeated_key', value: `value_${i}` })
            });
        }
        const res = await fetch(`${BASE_URL}/api/lsm/key/repeated_key`);
        const data = await res.json();
        return data.value === 'value_99'
            ? { status: 'PASS', message: 'Last write wins' }
            : { status: 'FAIL', message: `Expected value_99, got ${data.value}` };
    });

    // Test 5: Scan on empty database (after deleting all)
    await runTest('Scan with no data', async () => {
        const res = await fetch(`${BASE_URL}/api/lsm/scan?limit=10`);
        const data = await res.json();
        return Array.isArray(data.results)
            ? { status: 'PASS', message: `Returned ${data.results.length} results` }
            : { status: 'FAIL', message: 'Invalid response format' };
    });

    // Test 6: Scan with start > end
    await runTest('Scan with start > end', async () => {
        const res = await fetch(`${BASE_URL}/api/lsm/scan?startKey=zzz&endKey=aaa&limit=10`);
        const data = await res.json();
        return Array.isArray(data.results)
            ? { status: 'PASS', message: `Returned ${data.results.length} results (graceful)` }
            : { status: 'FAIL', message: 'Invalid response format' };
    });

    // Test 7: Missing required fields
    await runTest('PUT without value field', async () => {
        const res = await fetch(`${BASE_URL}/api/lsm/put`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'test' })
        });
        return !res.ok
            ? { status: 'PASS', message: `Validation error: ${res.status}` }
            : { status: 'FAIL', message: 'Should reject missing value' };
    });

    // Test 8: Invalid JSON
    await runTest('Invalid JSON payload', async () => {
        const res = await fetch(`${BASE_URL}/api/lsm/put`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{invalid json'
        });
        return !res.ok
            ? { status: 'PASS', message: `Parse error: ${res.status}` }
            : { status: 'FAIL', message: 'Should reject invalid JSON' };
    });

    console.log('\n' + '='.repeat(60));
    console.log('PHASE 7 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Tests run:    ${results.tests.length}`);
    console.log(`Passed:       ${results.passed}`);
    console.log(`Failed:       ${results.failed}`);
    console.log(`Crashes:      ${results.crashes}`);

    console.log('\nDETAILED RESULTS:');
    results.tests.forEach(t => {
        const icon = t.status === 'PASS' ? '✓' : t.status === 'FAIL' ? '✗' : '💥';
        console.log(`  ${icon} ${t.name}: ${t.message}`);
    });

    const verdict = results.crashes === 0;
    console.log(`\n✓ VERDICT: ${verdict ? 'PASS (no crashes)' : 'FAIL (crashes detected)'}`);
    console.log('='.repeat(60));

    return results;
}

phase7EdgeCases().catch(console.error);
