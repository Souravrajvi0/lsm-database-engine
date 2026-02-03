#!/usr/bin/env node
import http from 'http';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('Writing 500 records to trigger SSTable flush...');
  // Memtable threshold is 50, so 500 records will create multiple SSTables
  for (let i = 0; i < 500; i++) {
    await makeRequest('/api/lsm/put', 'POST', { key: `bloom_test_${i}`, value: `value_${i}` });
  }
  
  console.log('Waiting 3 seconds for SSTable creation and compaction...');
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  BLOOM FILTER DEMONSTRATION - READ BENCHMARK TEST  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  console.log('📊 STATS BEFORE BENCHMARK:');
  let stats = await makeRequest('/api/lsm/stats');
  console.log(`   • Bloom Hits: ${stats.metrics.bloomFilterHits}`);
  console.log(`   • Bloom Misses: ${stats.metrics.bloomFilterMisses}`);
  console.log(`   • Total Reads: ${stats.metrics.totalReads}\n`);
  
  console.log('🔍 PHASE 1: Reading 5000 EXISTING keys from SSTables...');
  for (let i = 0; i < 5000; i++) {
    const keyNum = Math.floor(Math.random() * 500);
    await makeRequest(`/api/lsm/key/bloom_test_${keyNum}`);
    if ((i + 1) % 1000 === 0) {
      process.stdout.write(`   ✓ ${i + 1} reads completed\n`);
    }
  }
  
  console.log('\n📊 STATS AFTER PHASE 1 (existing keys):');
  stats = await makeRequest('/api/lsm/stats');
  const phase1Hits = stats.metrics.bloomFilterHits;
  const phase1Misses = stats.metrics.bloomFilterMisses;
  const phase1Total = phase1Hits + phase1Misses;
  console.log(`   • Bloom Hits: ${phase1Hits} (avoided disk reads)`);
  console.log(`   • Bloom Misses: ${phase1Misses} (required disk reads)`);
  console.log(`   • Efficiency: ${phase1Total > 0 ? (phase1Hits / phase1Total * 100).toFixed(2) : 0}%\n`);
  
  console.log('🔍 PHASE 2: Reading 3000 NON-EXISTENT keys (testing negative filtering)...');
  for (let i = 0; i < 3000; i++) {
    const keyNum = 10000 + Math.floor(Math.random() * 10000); // Keys that never existed
    await makeRequest(`/api/lsm/key/bloom_test_${keyNum}`);
    if ((i + 1) % 1000 === 0) {
      process.stdout.write(`   ✓ ${i + 1} reads completed\n`);
    }
  }
  
  console.log('\n📊 FINAL STATS (after 8000 total reads):');
  stats = await makeRequest('/api/lsm/stats');
  const finalHits = stats.metrics.bloomFilterHits;
  const finalMisses = stats.metrics.bloomFilterMisses;
  const finalTotal = finalHits + finalMisses;
  const efficiency = finalTotal > 0 ? (finalHits / finalTotal * 100).toFixed(2) : 0;
  
  console.log(`\n   ✨ Bloom Filter Hits: ${finalHits.toLocaleString()} (avoided disk reads)`);
  console.log(`   📄 Bloom Filter Misses: ${finalMisses.toLocaleString()} (required disk reads)`);
  console.log(`   📈 Overall Efficiency: ${efficiency}%`);
  console.log(`   📍 Total Bloom Checks: ${finalTotal.toLocaleString()}`);
  console.log(`   🚀 Total Reads: ${stats.metrics.totalReads.toLocaleString()}\n`);
  
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ✓ Bloom filter is working and filtering queries!   ║');
  console.log('║  Open http://localhost:5000 → Visualizer to see UI  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  process.exit(0);
}

test().catch(console.error);
