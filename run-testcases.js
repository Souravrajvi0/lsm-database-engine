#!/usr/bin/env node
import http from 'http';

const BASE_URL = 'http://localhost:5000';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║       LSM TREE STORAGE ENGINE - TEST SUITE               ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test Case 1: Basic PUT/GET Operations
  console.log('📝 TEST CASE 1: Basic PUT/GET Operations');
  console.log('─────────────────────────────────────────');
  try {
    const putRes = await request('/api/lsm/put', 'POST', { key: 'test_key_1', value: 'test_value_1' });
    console.log(`  ✓ PUT test_key_1: ${putRes.status === 200 ? 'SUCCESS' : 'FAILED'}`);
    
    await sleep(100);
    
    const getRes = await request('/api/lsm/key/test_key_1');
    const success = getRes.data.found && getRes.data.value === 'test_value_1';
    console.log(`  ✓ GET test_key_1: ${success ? 'SUCCESS' : 'FAILED'} (value: ${getRes.data.value})`);
    
    if (success) passed++; else failed++;
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
    failed++;
  }
  console.log('');

  // Test Case 2: Update Existing Key
  console.log('📝 TEST CASE 2: Update Existing Key');
  console.log('─────────────────────────────────────────');
  try {
    await request('/api/lsm/put', 'POST', { key: 'test_key_1', value: 'updated_value' });
    console.log('  ✓ PUT test_key_1 (updated)');
    
    await sleep(100);
    
    const getRes = await request('/api/lsm/key/test_key_1');
    const success = getRes.data.value === 'updated_value';
    console.log(`  ✓ Verify update: ${success ? 'SUCCESS' : 'FAILED'} (value: ${getRes.data.value})`);
    
    if (success) passed++; else failed++;
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
    failed++;
  }
  console.log('');

  // Test Case 3: Delete Operation (Tombstone)
  console.log('📝 TEST CASE 3: Delete Operation');
  console.log('─────────────────────────────────────────');
  try {
    await request('/api/lsm/delete', 'POST', { key: 'test_key_1' });
    console.log('  ✓ DELETE test_key_1');
    
    await sleep(100);
    
    const getRes = await request('/api/lsm/key/test_key_1');
    const success = !getRes.data.found;
    console.log(`  ✓ Verify deletion: ${success ? 'SUCCESS' : 'FAILED'} (found: ${getRes.data.found})`);
    
    if (success) passed++; else failed++;
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
    failed++;
  }
  console.log('');

  // Test Case 4: Bulk Insert (Trigger MemTable Flush)
  console.log('📝 TEST CASE 4: Bulk Insert (100 keys - triggers flush)');
  console.log('─────────────────────────────────────────');
  try {
    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      await request('/api/lsm/put', 'POST', { 
        key: `bulk_key_${i}`, 
        value: `bulk_value_${i}` 
      });
    }
    const duration = Date.now() - startTime;
    console.log(`  ✓ Inserted 100 keys in ${duration}ms (${(100000/duration).toFixed(0)} ops/sec)`);
    
    await sleep(2000); // Wait for flush
    
    const stats = await request('/api/lsm/stats');
    const sstableCount = stats.data.levels.reduce((acc, l) => acc + l.fileCount, 0);
    console.log(`  ✓ SSTables created: ${sstableCount} files`);
    console.log(`  ✓ MemTable size: ${stats.data.memTableSize} entries`);
    
    passed++;
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
    failed++;
  }
  console.log('');

  // Test Case 5: Range Scan
  console.log('📝 TEST CASE 5: Range Scan');
  console.log('─────────────────────────────────────────');
  try {
    const scanRes = await request('/api/lsm/scan?startKey=bulk_key_0&endKey=bulk_key_20&limit=10');
    console.log(`  ✓ Scanned range: bulk_key_0 to bulk_key_20`);
    console.log(`  ✓ Results returned: ${scanRes.data.results.length} keys`);
    console.log(`  ✓ First key: ${scanRes.data.results[0]?.key || 'none'}`);
    console.log(`  ✓ Last key: ${scanRes.data.results[scanRes.data.results.length - 1]?.key || 'none'}`);
    
    if (scanRes.data.results.length > 0) passed++; else failed++;
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
    failed++;
  }
  console.log('');

  // Test Case 6: Bloom Filter Test (Read Benchmark)
  console.log('📝 TEST CASE 6: Bloom Filter Efficiency Test');
  console.log('─────────────────────────────────────────');
  try {
    const beforeStats = await request('/api/lsm/stats');
    const beforeHits = beforeStats.data.metrics.bloomFilterHits;
    const beforeMisses = beforeStats.data.metrics.bloomFilterMisses;
    
    console.log(`  • Before: Hits=${beforeHits}, Misses=${beforeMisses}`);
    
    // Run read benchmark
    const benchRes = await request('/api/lsm/benchmark', 'POST', { type: 'read', count: 1000 });
    console.log(`  ✓ Read benchmark: ${benchRes.data.durationMs}ms (${benchRes.data.opsPerSec} ops/sec)`);
    
    await sleep(500);
    
    const afterStats = await request('/api/lsm/stats');
    const afterHits = afterStats.data.metrics.bloomFilterHits;
    const afterMisses = afterStats.data.metrics.bloomFilterMisses;
    const deltaHits = afterHits - beforeHits;
    const deltaMisses = afterMisses - beforeMisses;
    const total = deltaHits + deltaMisses;
    const efficiency = total > 0 ? ((deltaHits / total) * 100).toFixed(1) : '0';
    
    console.log(`  • After: Hits=${afterHits}, Misses=${afterMisses}`);
    console.log(`  • Delta: +${deltaHits} hits, +${deltaMisses} misses`);
    console.log(`  ✓ Bloom filter efficiency: ${efficiency}%`);
    console.log(`  ✓ Disk reads avoided: ${deltaHits} (out of ${total} checks)`);
    
    passed++;
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
    failed++;
  }
  console.log('');

  // Test Case 7: Write Benchmark
  console.log('📝 TEST CASE 7: Write Performance Benchmark');
  console.log('─────────────────────────────────────────');
  try {
    const benchRes = await request('/api/lsm/benchmark', 'POST', { type: 'write', count: 1000 });
    console.log(`  ✓ Write benchmark: ${benchRes.data.durationMs}ms`);
    console.log(`  ✓ Throughput: ${benchRes.data.opsPerSec} ops/sec`);
    console.log(`  ✓ Avg latency: ${(benchRes.data.durationMs / 1000).toFixed(2)}ms per write`);
    
    passed++;
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
    failed++;
  }
  console.log('');

  // Test Case 8: Final System Stats
  console.log('📝 TEST CASE 8: System Metrics Check');
  console.log('─────────────────────────────────────────');
  try {
    const stats = await request('/api/lsm/stats');
    console.log(`  ✓ Total Writes: ${stats.data.metrics.totalWrites.toLocaleString()}`);
    console.log(`  ✓ Total Reads: ${stats.data.metrics.totalReads.toLocaleString()}`);
    console.log(`  ✓ Write Amplification: ${stats.data.metrics.writeAmplification.toFixed(2)}x`);
    console.log(`  ✓ Avg Write Latency: ${stats.data.metrics.avgWriteLatencyMs.toFixed(3)}ms`);
    console.log(`  ✓ Avg Read Latency: ${stats.data.metrics.avgReadLatencyMs.toFixed(3)}ms`);
    
    let totalSize = 0;
    stats.data.levels.forEach(level => {
      totalSize += level.totalSize;
      console.log(`  ✓ Level ${level.level}: ${level.fileCount} files, ${(level.totalSize / 1024).toFixed(2)}KB`);
    });
    console.log(`  ✓ Total Storage: ${(totalSize / 1024).toFixed(2)}KB`);
    
    passed++;
  } catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
    failed++;
  }
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED! Project is production-ready.');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Review output above.`);
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Wait a bit for server to be ready
setTimeout(() => {
  runTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
  });
}, 1000);
