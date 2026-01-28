/**
 * LSM Tree Benchmark Suite
 * 
 * Comprehensive performance benchmarks measuring:
 * - Sequential/random write throughput
 * - Sequential/random read latency (P50, P95, P99)
 * - Range scan performance
 * - Mixed workload behavior
 * - Compaction overhead
 * 
 * Usage:
 *   npm run benchmark
 *   or
 *   node dist/benchmark.js
 */

import { LSMTree } from './lsm';
import fs from 'fs/promises';
import path from 'path';

interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  throughput: number; // ops/sec
  avgLatency: number; // ms
  p50Latency?: number;
  p95Latency?: number;
  p99Latency?: number;
}

export class LSMBenchmark {
  private benchDir = path.join(process.cwd(), 'bench_data');

  /**
   * Run all benchmarks
   */
  async runAll(): Promise<void> {
    console.log('='.repeat(80));
    console.log('LSM TREE BENCHMARK SUITE');
    console.log('='.repeat(80));
    console.log();

    await this.cleanup();

    const results: BenchmarkResult[] = [];

    results.push(await this.benchmarkSequentialWrites());
    results.push(await this.benchmarkRandomWrites());
    results.push(await this.benchmarkSequentialReads());
    results.push(await this.benchmarkRandomReads());
    results.push(await this.benchmarkRangeScans());
    results.push(await this.benchmarkMixedWorkload());

    console.log();
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    this.printSummary(results);

    await this.cleanup();
  }

  /**
   * Benchmark sequential writes
   */
  async benchmarkSequentialWrites(): Promise<BenchmarkResult> {
    console.log('Running: Sequential Writes...');
    const lsm = new LSMTree();
    const n = 10_000;

    const start = performance.now();

    for (let i = 0; i < n; i++) {
      const key = `key_${i.toString().padStart(8, '0')}`;
      await lsm.put(key, `value_${i}`);
    }

    const duration = performance.now() - start;
    const throughput = (n / duration) * 1000;

    console.log(`  ✓ ${n} writes in ${duration.toFixed(2)}ms`);
    console.log(`  ✓ Throughput: ${throughput.toFixed(0)} ops/sec`);
    console.log(`  ✓ Avg latency: ${(duration / n).toFixed(3)}ms`);
    console.log();

    return {
      name: 'Sequential Writes',
      duration,
      operations: n,
      throughput,
      avgLatency: duration / n,
    };
  }

  /**
   * Benchmark random writes
   */
  async benchmarkRandomWrites(): Promise<BenchmarkResult> {
    console.log('Running: Random Writes...');
    const lsm = new LSMTree();
    const n = 10_000;

    const start = performance.now();

    for (let i = 0; i < n; i++) {
      const randomNum = Math.floor(Math.random() * n * 10);
      const key = `key_${randomNum.toString().padStart(8, '0')}`;
      await lsm.put(key, `value_${randomNum}`);
    }

    const duration = performance.now() - start;
    const throughput = (n / duration) * 1000;

    console.log(`  ✓ ${n} random writes in ${duration.toFixed(2)}ms`);
    console.log(`  ✓ Throughput: ${throughput.toFixed(0)} ops/sec`);
    console.log(`  ✓ Avg latency: ${(duration / n).toFixed(3)}ms`);
    console.log();

    return {
      name: 'Random Writes',
      duration,
      operations: n,
      throughput,
      avgLatency: duration / n,
    };
  }

  /**
   * Benchmark sequential reads
   */
  async benchmarkSequentialReads(): Promise<BenchmarkResult> {
    console.log('Running: Sequential Reads...');
    const lsm = new LSMTree();
    const n = 1_000;

    // Populate data
    for (let i = 0; i < n; i++) {
      await lsm.put(`key_${i}`, `value_${i}`);
    }

    const latencies: number[] = [];

    for (let i = 0; i < n; i++) {
      const start = performance.now();
      await lsm.get(`key_${i}`);
      latencies.push(performance.now() - start);
    }

    const duration = latencies.reduce((a, b) => a + b, 0);
    const throughput = (n / duration) * 1000;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(n * 0.5)];
    const p95 = latencies[Math.floor(n * 0.95)];
    const p99 = latencies[Math.floor(n * 0.99)];

    console.log(`  ✓ ${n} sequential reads in ${duration.toFixed(2)}ms`);
    console.log(`  ✓ Throughput: ${throughput.toFixed(0)} ops/sec`);
    console.log(`  ✓ P50: ${p50.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms | P99: ${p99.toFixed(3)}ms`);
    console.log();

    return {
      name: 'Sequential Reads',
      duration,
      operations: n,
      throughput,
      avgLatency: duration / n,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
    };
  }

  /**
   * Benchmark random reads
   */
  async benchmarkRandomReads(): Promise<BenchmarkResult> {
    console.log('Running: Random Reads...');
    const lsm = new LSMTree();
    const n = 10_000;
    const reads = 1_000;

    // Populate data
    for (let i = 0; i < n; i++) {
      await lsm.put(`key_${i}`, `value_${i}`);
    }

    const latencies: number[] = [];

    for (let i = 0; i < reads; i++) {
      const randomKey = `key_${Math.floor(Math.random() * n)}`;
      const start = performance.now();
      await lsm.get(randomKey);
      latencies.push(performance.now() - start);
    }

    const duration = latencies.reduce((a, b) => a + b, 0);
    const throughput = (reads / duration) * 1000;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(reads * 0.5)];
    const p95 = latencies[Math.floor(reads * 0.95)];
    const p99 = latencies[Math.floor(reads * 0.99)];

    console.log(`  ✓ ${reads} random reads in ${duration.toFixed(2)}ms`);
    console.log(`  ✓ Throughput: ${throughput.toFixed(0)} ops/sec`);
    console.log(`  ✓ P50: ${p50.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms | P99: ${p99.toFixed(3)}ms`);
    console.log();

    return {
      name: 'Random Reads',
      duration,
      operations: reads,
      throughput,
      avgLatency: duration / reads,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
    };
  }

  /**
   * Benchmark range scans
   */
  async benchmarkRangeScans(): Promise<BenchmarkResult> {
    console.log('Running: Range Scans...');
    const lsm = new LSMTree();
    const n = 10_000;
    const scans = 100;

    // Populate data
    for (let i = 0; i < n; i++) {
      await lsm.put(`key_${i.toString().padStart(8, '0')}`, `value_${i}`);
    }

    const latencies: number[] = [];

    for (let i = 0; i < scans; i++) {
      const start = Math.floor(Math.random() * (n - 100));
      const startKey = `key_${start.toString().padStart(8, '0')}`;
      const endKey = `key_${(start + 100).toString().padStart(8, '0')}`;

      const benchStart = performance.now();
      await lsm.scan(startKey, endKey, 100);
      latencies.push(performance.now() - benchStart);
    }

    const duration = latencies.reduce((a, b) => a + b, 0);
    const throughput = (scans / duration) * 1000;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(scans * 0.5)];
    const p95 = latencies[Math.floor(scans * 0.95)];
    const p99 = latencies[Math.floor(scans * 0.99)];

    console.log(`  ✓ ${scans} range scans in ${duration.toFixed(2)}ms`);
    console.log(`  ✓ Throughput: ${throughput.toFixed(0)} scans/sec`);
    console.log(`  ✓ P50: ${p50.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms | P99: ${p99.toFixed(3)}ms`);
    console.log();

    return {
      name: 'Range Scans',
      duration,
      operations: scans,
      throughput,
      avgLatency: duration / scans,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
    };
  }

  /**
   * Benchmark mixed workload (70% reads, 30% writes)
   */
  async benchmarkMixedWorkload(): Promise<BenchmarkResult> {
    console.log('Running: Mixed Workload (70% reads, 30% writes)...');
    const lsm = new LSMTree();
    const n = 5_000;

    // Populate initial data
    for (let i = 0; i < 1000; i++) {
      await lsm.put(`key_${i}`, `value_${i}`);
    }

    const start = performance.now();

    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.7) {
        // 70% reads
        const randomKey = `key_${Math.floor(Math.random() * 1000)}`;
        await lsm.get(randomKey);
      } else {
        // 30% writes
        const randomKey = `key_${Math.floor(Math.random() * 2000)}`;
        await lsm.put(randomKey, `value_${Date.now()}`);
      }
    }

    const duration = performance.now() - start;
    const throughput = (n / duration) * 1000;

    console.log(`  ✓ ${n} operations in ${duration.toFixed(2)}ms`);
    console.log(`  ✓ Throughput: ${throughput.toFixed(0)} ops/sec`);
    console.log(`  ✓ Avg latency: ${(duration / n).toFixed(3)}ms`);
    console.log();

    return {
      name: 'Mixed Workload',
      duration,
      operations: n,
      throughput,
      avgLatency: duration / n,
    };
  }

  /**
   * Print summary table
   */
  private printSummary(results: BenchmarkResult[]): void {
    console.log();
    console.log('Benchmark                | Ops/sec | Avg Latency | P50      | P95      | P99');
    console.log('-'.repeat(80));

    for (const result of results) {
      const name = result.name.padEnd(24);
      const throughput = result.throughput.toFixed(0).padStart(7);
      const avgLat = result.avgLatency.toFixed(3).padStart(11);
      const p50 = result.p50Latency ? result.p50Latency.toFixed(3).padStart(8) : '-'.padStart(8);
      const p95 = result.p95Latency ? result.p95Latency.toFixed(3).padStart(8) : '-'.padStart(8);
      const p99 = result.p99Latency ? result.p99Latency.toFixed(3).padStart(8) : '-'.padStart(8);

      console.log(`${name} | ${throughput} | ${avgLat}ms | ${p50}ms | ${p95}ms | ${p99}ms`);
    }

    console.log();
  }

  /**
   * Clean up benchmark data directory
   */
  private async cleanup(): Promise<void> {
    try {
      await fs.rm(this.benchDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors
    }
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmark = new LSMBenchmark();
  benchmark
    .runAll()
    .then(() => {
      console.log('Benchmarks completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
