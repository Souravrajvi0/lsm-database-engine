#!/usr/bin/env node
/**
 * LSM Tree Stress Tester CLI
 *
 * Generates configurable load against LSM storage engine
 * Supports: writes, reads, batch operations, and performance tracking
 *
 * Usage:
 *   npx ts-node tools/stress-tester.ts --duration 60 --ops-per-sec 1000 --data-size 1024
 *   npx ts-node tools/stress-tester.ts --test batch --duration 30
 */

import http from 'http';
import { performance } from 'perf_hooks';

interface StressTesterOptions {
  host: string;
  port: number;
  duration: number; // seconds
  opsPerSec: number;
  dataSize: number; // bytes per value
  testMode: 'mixed' | 'writes' | 'reads' | 'batch';
  batchSize: number;
}

interface StressStats {
  totalOperations: number;
  successfulOps: number;
  failedOps: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  startTime: number;
  endTime: number;
}

class StressTester {
  private options: StressTesterOptions;
  private stats: StressStats;
  private latencies: number[] = [];
  private isRunning: boolean = false;
  private operationCount: number = 0;

  constructor(options: Partial<StressTesterOptions> = {}) {
    this.options = {
      host: options.host || 'localhost',
      port: options.port || 5000,
      duration: options.duration || 60,
      opsPerSec: options.opsPerSec || 100,
      dataSize: options.dataSize || 1024,
      testMode: options.testMode || 'mixed',
      batchSize: options.batchSize || 10,
    };

    this.stats = {
      totalOperations: 0,
      successfulOps: 0,
      failedOps: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      startTime: 0,
      endTime: 0,
    };
  }

  private makeRequest(method: string, path: string, body?: string): Promise<{ status: number; data: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(`http://${this.options.host}:${this.options.port}${path}`);
      const options: any = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const startTime = performance.now();

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const latency = performance.now() - startTime;
          this.recordLatency(latency);
          resolve({ status: res.statusCode || 500, data });
        });
      });

      req.on('error', (err) => {
        const latency = performance.now() - startTime;
        this.recordLatency(latency);
        reject(err);
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  private recordLatency(latency: number): void {
    this.latencies.push(latency);
    this.stats.totalLatency += latency;
    this.stats.minLatency = Math.min(this.stats.minLatency, latency);
    this.stats.maxLatency = Math.max(this.stats.maxLatency, latency);
  }

  private generateRandomKey(): string {
    return `key_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
  }

  private generateRandomValue(): string {
    return 'x'.repeat(this.options.dataSize);
  }

  private async performWrite(): Promise<void> {
    const key = this.generateRandomKey();
    const value = this.generateRandomValue();

    try {
      await this.makeRequest('POST', '/api/write', JSON.stringify({ key, value }));
      this.stats.successfulOps++;
    } catch (err) {
      this.stats.failedOps++;
    }

    this.stats.totalOperations++;
  }

  private async performRead(): Promise<void> {
    // Read a random key (or miss)
    const key = this.generateRandomKey();

    try {
      await this.makeRequest('GET', `/api/read/${encodeURIComponent(key)}`);
      this.stats.successfulOps++;
    } catch (err) {
      this.stats.failedOps++;
    }

    this.stats.totalOperations++;
  }

  private async performBatch(): Promise<void> {
    const operations = [];
    for (let i = 0; i < this.options.batchSize; i++) {
      operations.push({
        type: Math.random() > 0.3 ? 'write' : 'delete',
        key: this.generateRandomKey(),
        value: this.generateRandomValue(),
      });
    }

    try {
      await this.makeRequest('POST', '/api/batch', JSON.stringify({ operations }));
      this.stats.successfulOps += operations.length;
    } catch (err) {
      this.stats.failedOps += operations.length;
    }

    this.stats.totalOperations++;
  }

  private async performMixed(): Promise<void> {
    const rand = Math.random();
    if (rand < 0.5) {
      await this.performWrite();
    } else if (rand < 0.9) {
      await this.performRead();
    } else {
      await this.performBatch();
    }
  }

  private async runOperation(): Promise<void> {
    switch (this.options.testMode) {
      case 'writes':
        await this.performWrite();
        break;
      case 'reads':
        await this.performRead();
        break;
      case 'batch':
        await this.performBatch();
        break;
      case 'mixed':
      default:
        await this.performMixed();
    }
  }

  private calculatePercentile(p: number): number {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private printProgressBar(elapsed: number, total: number): void {
    const percentage = (elapsed / total) * 100;
    const filled = Math.floor(percentage / 2);
    const empty = 50 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const ops = this.stats.successfulOps + this.stats.failedOps;
    const opsPerSec = (ops / elapsed).toFixed(0);

    process.stdout.write(`\r[${bar}] ${percentage.toFixed(1)}% | ${ops} ops | ${opsPerSec} ops/sec`);
  }

  async run(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  LSM Tree Stress Tester');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Target: ${this.options.host}:${this.options.port}`);
    console.log(`Duration: ${this.options.duration}s`);
    console.log(`Mode: ${this.options.testMode}`);
    console.log(`Target Rate: ${this.options.opsPerSec} ops/sec`);
    console.log(`Data Size: ${this.options.dataSize} bytes/value`);
    console.log('───────────────────────────────────────────────────────\n');

    this.isRunning = true;
    this.stats.startTime = Date.now();
    const endTime = this.stats.startTime + this.options.duration * 1000;
    const intervalMs = 1000 / this.options.opsPerSec;

    const operationInterval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(operationInterval);
        this.isRunning = false;
        this.stats.endTime = Date.now();
        this.printResults();
        process.exit(0);
      }

      await this.runOperation();
    }, intervalMs);

    // Progress update every second
    const progressInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(progressInterval);
        return;
      }
      const elapsed = (Date.now() - this.stats.startTime) / 1000;
      this.printProgressBar(elapsed, this.options.duration);
    }, 1000);
  }

  private printResults(): void {
    const durationSec = (this.stats.endTime - this.stats.startTime) / 1000;
    const successRate = (this.stats.successfulOps / (this.stats.successfulOps + this.stats.failedOps)) * 100;

    this.stats.p50Latency = this.calculatePercentile(50);
    this.stats.p95Latency = this.calculatePercentile(95);
    this.stats.p99Latency = this.calculatePercentile(99);

    const avgLatency = this.stats.totalLatency / (this.stats.successfulOps + this.stats.failedOps);

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('  Results');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Duration: ${durationSec.toFixed(2)}s`);
    console.log(`Total Operations: ${this.stats.totalOperations}`);
    console.log(`Successful: ${this.stats.successfulOps} (${successRate.toFixed(2)}%)`);
    console.log(`Failed: ${this.stats.failedOps}`);
    console.log(`Throughput: ${((this.stats.successfulOps + this.stats.failedOps) / durationSec).toFixed(0)} ops/sec`);
    console.log('\nLatency Metrics (ms):');
    console.log(`  Min: ${this.stats.minLatency.toFixed(3)}ms`);
    console.log(`  Avg: ${avgLatency.toFixed(3)}ms`);
    console.log(`  p50: ${this.stats.p50Latency.toFixed(3)}ms`);
    console.log(`  p95: ${this.stats.p95Latency.toFixed(3)}ms`);
    console.log(`  p99: ${this.stats.p99Latency.toFixed(3)}ms`);
    console.log(`  Max: ${this.stats.maxLatency.toFixed(3)}ms`);
    console.log('═══════════════════════════════════════════════════════\n');
  }
}

// Parse CLI arguments
function parseArgs(): Partial<StressTesterOptions> {
  const args = process.argv.slice(2);
  const options: any = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    switch (key) {
      case 'duration':
        options.duration = parseInt(value, 10);
        break;
      case 'ops-per-sec':
        options.opsPerSec = parseInt(value, 10);
        break;
      case 'data-size':
        options.dataSize = parseInt(value, 10);
        break;
      case 'test':
        options.testMode = value;
        break;
      case 'batch-size':
        options.batchSize = parseInt(value, 10);
        break;
      case 'host':
        options.host = value;
        break;
      case 'port':
        options.port = parseInt(value, 10);
        break;
    }
  }

  return options;
}

// Main
const args = parseArgs();
const tester = new StressTester(args);
tester.run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
