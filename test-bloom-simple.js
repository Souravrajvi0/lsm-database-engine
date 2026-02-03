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
      },
      timeout: 60000
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

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });
    req.on('timeout', () => {
      console.error('Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  try {
    console.log('📊 Running Bloom Filter Demonstration...\n');
    
    // Call the read benchmark endpoint (1000 reads)
    console.log('🚀 Sending 1000 read requests to /api/lsm/benchmark (read)...');
    const result = await makeRequest('/api/lsm/benchmark', 'POST', {
      type: 'read',
      count: 1000
    });
    
    console.log(`✓ Benchmark complete: ${result.durationMs}ms, ${result.opsPerSec} ops/sec\n`);
    
    // Check stats
    console.log('📈 Checking Bloom Filter Statistics...');
    const stats = await makeRequest('/api/lsm/stats');
    
    console.log(`✨ Bloom Filter Hits: ${stats.metrics.bloomFilterHits.toLocaleString()} (avoided disk reads)`);
    console.log(`📄 Bloom Filter Misses: ${stats.metrics.bloomFilterMisses.toLocaleString()} (required disk reads)`);
    const total = stats.metrics.bloomFilterHits + stats.metrics.bloomFilterMisses;
    const efficiency = total > 0 ? ((stats.metrics.bloomFilterHits / total) * 100).toFixed(2) : '0.00';
    console.log(`📊 Efficiency: ${efficiency}%`);
    console.log(`🎯 Total Bloom Checks: ${total.toLocaleString()}`);
    console.log(`📍 Total Reads: ${stats.metrics.totalReads.toLocaleString()}\n`);
    
    console.log('✅ Bloom filter is active! Open http://localhost:5000 to see UI');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
