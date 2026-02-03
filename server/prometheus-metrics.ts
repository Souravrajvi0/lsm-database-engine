import client from 'prom-client';

// Create register
export const register = new client.Registry();

// Histogram metrics
export const writeLatency = new client.Histogram({
  name: 'lsm_write_latency_ms',
  help: 'Write operation latency in milliseconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 50, 100],
  registers: [register]
});

export const readLatency = new client.Histogram({
  name: 'lsm_read_latency_ms',
  help: 'Read operation latency in milliseconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 50, 100],
  registers: [register]
});

export const deleteLatency = new client.Histogram({
  name: 'lsm_delete_latency_ms',
  help: 'Delete operation latency in milliseconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 50, 100],
  registers: [register]
});

export const scanLatency = new client.Histogram({
  name: 'lsm_scan_latency_ms',
  help: 'Scan operation latency in milliseconds',
  buckets: [1, 5, 10, 50, 100, 500],
  registers: [register]
});

export const batchLatency = new client.Histogram({
  name: 'lsm_batch_latency_ms',
  help: 'Batch operation latency in milliseconds',
  buckets: [1, 5, 10, 50, 100, 500],
  registers: [register]
});

// Counter metrics
export const writeCount = new client.Counter({
  name: 'lsm_write_total',
  help: 'Total write operations',
  registers: [register]
});

export const readCount = new client.Counter({
  name: 'lsm_read_total',
  help: 'Total read operations',
  registers: [register]
});

export const deleteCount = new client.Counter({
  name: 'lsm_delete_total',
  help: 'Total delete operations',
  registers: [register]
});

export const bloomFilterHits = new client.Counter({
  name: 'lsm_bloom_filter_hits_total',
  help: 'Total bloom filter hits',
  registers: [register]
});

export const bloomFilterMisses = new client.Counter({
  name: 'lsm_bloom_filter_misses_total',
  help: 'Total bloom filter misses',
  registers: [register]
});

export const compactionCount = new client.Counter({
  name: 'lsm_compaction_total',
  help: 'Total compaction operations',
  registers: [register]
});

export const walWriteCount = new client.Counter({
  name: 'lsm_wal_write_total',
  help: 'Total WAL writes',
  registers: [register]
});

// Gauge metrics
export const memtableSize = new client.Gauge({
  name: 'lsm_memtable_size',
  help: 'Current memtable size in bytes',
  registers: [register]
});

export const memtableEntries = new client.Gauge({
  name: 'lsm_memtable_entries',
  help: 'Current memtable entry count',
  registers: [register]
});

export const sstableCount = new client.Gauge({
  name: 'lsm_sstable_count',
  help: 'Total SSTable count',
  registers: [register]
});

export const diskUsage = new client.Gauge({
  name: 'lsm_disk_usage_bytes',
  help: 'Total disk usage in bytes',
  registers: [register]
});

export const levelCount = new client.Gauge({
  name: 'lsm_level_count',
  help: 'Number of LSM levels',
  registers: [register]
});

export const compactionInProgress = new client.Gauge({
  name: 'lsm_compaction_in_progress',
  help: 'Whether compaction is currently running',
  registers: [register]
});

// Summary for more detailed percentiles
export const operationDuration = new client.Summary({
  name: 'lsm_operation_duration_seconds',
  help: 'Operation duration in seconds with percentiles',
  percentiles: [0.5, 0.95, 0.99],
  registers: [register]
});

export function recordWriteMetric(durationMs: number) {
  writeLatency.observe(durationMs);
  writeCount.inc();
  operationDuration.observe(durationMs / 1000);
}

export function recordReadMetric(durationMs: number) {
  readLatency.observe(durationMs);
  readCount.inc();
  operationDuration.observe(durationMs / 1000);
}

export function recordDeleteMetric(durationMs: number) {
  deleteLatency.observe(durationMs);
  deleteCount.inc();
  operationDuration.observe(durationMs / 1000);
}

export function recordScanMetric(durationMs: number) {
  scanLatency.observe(durationMs);
  operationDuration.observe(durationMs / 1000);
}

export function recordBatchMetric(durationMs: number, operationCount: number) {
  batchLatency.observe(durationMs);
  operationDuration.observe(durationMs / 1000);
  writeCount.inc(operationCount);
}

export function recordBloomFilterHit() {
  bloomFilterHits.inc();
}

export function recordBloomFilterMiss() {
  bloomFilterMisses.inc();
}

export function recordCompaction(durationMs: number) {
  compactionCount.inc();
  operationDuration.observe(durationMs / 1000);
}

export function recordWALWrite() {
  walWriteCount.inc();
}

export function updateMemtableMetrics(sizeBytes: number, entryCount: number) {
  memtableSize.set(sizeBytes);
  memtableEntries.set(entryCount);
}

export function updateDiskMetrics(sstableCount: number, diskUsageBytes: number, levels: number) {
  exports.sstableCount.set(sstableCount);
  diskUsage.set(diskUsageBytes);
  levelCount.set(levels);
}

export function setCompactionInProgress(inProgress: boolean) {
  compactionInProgress.set(inProgress ? 1 : 0);
}
