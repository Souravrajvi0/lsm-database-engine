/**
 * Performance Metrics System
 * 
 * Tracks operation latencies and calculates percentiles (P50, P95, P99)
 * Provides real-time performance monitoring and observability
 * 
 * Features:
 * - Rolling window histogram (configurable size)
 * - Efficient percentile calculation
 * - Per-operation type tracking
 * - Export to JSON for monitoring dashboards
 */

export interface PercentileMetrics {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  uptime: number;
  operations: {
    get: PercentileMetrics;
    put: PercentileMetrics;
    delete: PercentileMetrics;
    scan: PercentileMetrics;
  };
  compaction: {
    totalCompactions: number;
    avgDuration: number;
    lastCompaction?: number;
  };
  storage: {
    memTableSize: number;
    sstableCount: number;
    bloomFilterHitRate?: number;
  };
}

/**
 * Histogram for tracking latency distribution
 */
class Histogram {
  private latencies: number[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10_000) {
    this.maxSize = maxSize;
  }

  /**
   * Record a latency measurement
   */
  record(latencyMs: number): void {
    this.latencies.push(latencyMs);
    
    // Keep only the most recent measurements
    if (this.latencies.length > this.maxSize) {
      this.latencies.shift();
    }
  }

  /**
   * Calculate percentile metrics
   */
  getMetrics(): PercentileMetrics {
    if (this.latencies.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      mean: sum / count,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  /**
   * Calculate specific percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Reset all measurements
   */
  reset(): void {
    this.latencies = [];
  }

  /**
   * Get raw latency data
   */
  getRawData(): number[] {
    return [...this.latencies];
  }
}

/**
 * Main metrics collector
 */
export class MetricsCollector {
  private startTime = Date.now();
  private histograms = {
    get: new Histogram(),
    put: new Histogram(),
    delete: new Histogram(),
    scan: new Histogram(),
    batch: new Histogram(),
  };

  private compactionMetrics = {
    count: 0,
    totalDuration: 0,
    lastCompaction: 0,
  };

  private storageMetrics = {
    memTableSize: 0,
    sstableCount: 0,
    bloomFilterHits: 0,
    bloomFilterMisses: 0,
  };

  /**
   * Record a GET operation latency
   */
  recordGet(latencyMs: number): void {
    this.histograms.get.record(latencyMs);
  }

  /**
   * Record a PUT operation latency
   */
  recordPut(latencyMs: number): void {
    this.histograms.put.record(latencyMs);
  }

  /**
   * Record a DELETE operation latency
   */
  recordDelete(latencyMs: number): void {
    this.histograms.delete.record(latencyMs);
  }

  /**
   * Record a SCAN operation latency
   */
  recordScan(latencyMs: number): void {
    this.histograms.scan.record(latencyMs);
  }

  /**
   * Record a batch PUT operation latency
   */
  recordBatchPut(latencyMs: number, operationCount: number): void {
    this.histograms.batch.record(latencyMs);
    // Also count individual operations for write count
    for (let i = 0; i < operationCount; i++) {
      this.histograms.put.record(latencyMs / operationCount);
    }
  }

  /**
   * Record a batch DELETE operation latency
   */
  recordBatchDelete(latencyMs: number, operationCount: number): void {
    this.histograms.batch.record(latencyMs);
    // Also count individual operations for delete count
    for (let i = 0; i < operationCount; i++) {
      this.histograms.delete.record(latencyMs / operationCount);
    }
  }

  /**
   * Record a compaction event
   */
  recordCompaction(durationMs: number): void {
    this.compactionMetrics.count++;
    this.compactionMetrics.totalDuration += durationMs;
    this.compactionMetrics.lastCompaction = Date.now();
  }

  /**
   * Update storage metrics
   */
  updateStorage(memTableSize: number, sstableCount: number): void {
    this.storageMetrics.memTableSize = memTableSize;
    this.storageMetrics.sstableCount = sstableCount;
  }

  /**
   * Record bloom filter hit/miss
   */
  recordBloomFilter(hit: boolean): void {
    if (hit) {
      this.storageMetrics.bloomFilterHits++;
    } else {
      this.storageMetrics.bloomFilterMisses++;
    }
  }

  /**
   * Get complete metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const uptime = now - this.startTime;

    const bloomTotal = this.storageMetrics.bloomFilterHits + this.storageMetrics.bloomFilterMisses;
    const bloomFilterHitRate = bloomTotal > 0
      ? this.storageMetrics.bloomFilterHits / bloomTotal
      : undefined;

    return {
      timestamp: now,
      uptime,
      operations: {
        get: this.histograms.get.getMetrics(),
        put: this.histograms.put.getMetrics(),
        delete: this.histograms.delete.getMetrics(),
        scan: this.histograms.scan.getMetrics(),
      },
      compaction: {
        totalCompactions: this.compactionMetrics.count,
        avgDuration:
          this.compactionMetrics.count > 0
            ? this.compactionMetrics.totalDuration / this.compactionMetrics.count
            : 0,
        lastCompaction: this.compactionMetrics.lastCompaction || undefined,
      },
      storage: {
        memTableSize: this.storageMetrics.memTableSize,
        sstableCount: this.storageMetrics.sstableCount,
        bloomFilterHitRate,
      },
    };
  }

  /**
   * Export metrics as JSON string
   */
  exportJSON(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  /**
   * Print metrics to console in human-readable format
   */
  printSummary(): void {
    const snapshot = this.getSnapshot();
    
    console.log('\n=== LSM Tree Performance Metrics ===');
    console.log(`Uptime: ${(snapshot.uptime / 1000).toFixed(1)}s`);
    console.log();

    console.log('Operations:');
    for (const [op, metrics] of Object.entries(snapshot.operations)) {
      if (metrics.count > 0) {
        console.log(`  ${op.toUpperCase()}:`);
        console.log(`    Count: ${metrics.count}`);
        console.log(`    Mean: ${metrics.mean.toFixed(3)}ms`);
        console.log(`    P50: ${metrics.p50.toFixed(3)}ms`);
        console.log(`    P95: ${metrics.p95.toFixed(3)}ms`);
        console.log(`    P99: ${metrics.p99.toFixed(3)}ms`);
        console.log(`    Min/Max: ${metrics.min.toFixed(3)}ms / ${metrics.max.toFixed(3)}ms`);
      }
    }

    console.log();
    console.log('Compaction:');
    console.log(`  Total: ${snapshot.compaction.totalCompactions}`);
    console.log(`  Avg Duration: ${snapshot.compaction.avgDuration.toFixed(2)}ms`);
    if (snapshot.compaction.lastCompaction) {
      const elapsed = (Date.now() - snapshot.compaction.lastCompaction) / 1000;
      console.log(`  Last: ${elapsed.toFixed(1)}s ago`);
    }

    console.log();
    console.log('Storage:');
    console.log(`  MemTable Size: ${snapshot.storage.memTableSize}`);
    console.log(`  SSTable Count: ${snapshot.storage.sstableCount}`);
    if (snapshot.storage.bloomFilterHitRate !== undefined) {
      console.log(`  Bloom Filter Hit Rate: ${(snapshot.storage.bloomFilterHitRate * 100).toFixed(1)}%`);
    }
    
    console.log();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.startTime = Date.now();
    this.histograms.get.reset();
    this.histograms.put.reset();
    this.histograms.delete.reset();
    this.histograms.scan.reset();
    this.compactionMetrics = {
      count: 0,
      totalDuration: 0,
      lastCompaction: 0,
    };
    this.storageMetrics = {
      memTableSize: 0,
      sstableCount: 0,
      bloomFilterHits: 0,
      bloomFilterMisses: 0,
    };
  }
}

// Global singleton instance
export const metrics = new MetricsCollector();
