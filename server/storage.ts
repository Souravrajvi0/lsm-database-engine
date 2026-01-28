import { lsm } from "./lsm";
import { KVPair, LsmStats, ScanRequest, PutRequest } from "@shared/schema";
import { MetricsSnapshot } from "./metrics";

// This interface wraps our LSM Engine for the API
export interface IStorage {
  // KV Operations
  get(key: string): Promise<string | null>;
  put(entry: PutRequest): Promise<void>;
  delete(key: string): Promise<void>;
  scan(request: ScanRequest): Promise<KVPair[]>;

  // Batch Operations
  batchPut(entries: Array<{key: string, value: string}>): Promise<void>;
  batchDelete(keys: string[]): Promise<void>;

  // System Operations
  getStats(): Promise<LsmStats>;
  triggerCompaction(): Promise<void>;
  getMetrics(): MetricsSnapshot;

  // Expose lsm for health checks
  readonly lsm: typeof lsm;
}

export class LSMStorage implements IStorage {
  lsm = lsm;

  async get(key: string): Promise<string | null> {
    return await lsm.get(key);
  }

  async put(entry: PutRequest): Promise<void> {
    await lsm.put(entry.key, entry.value);
  }

  async delete(key: string): Promise<void> {
    await lsm.delete(key);
  }

  async batchPut(entries: Array<{key: string, value: string}>): Promise<void> {
    await lsm.batchPut(entries);
  }

  async batchDelete(keys: string[]): Promise<void> {
    await lsm.batchDelete(keys);
  }

  async scan(request: ScanRequest): Promise<KVPair[]> {
    return await lsm.scan(request.startKey, request.endKey, request.limit);
  }

  async getStats(): Promise<LsmStats> {
    return lsm.getStats();
  }

  async triggerCompaction(): Promise<void> {
    // Run compaction in background
    lsm.compact().catch(console.error);
  }

  getMetrics(): MetricsSnapshot {
    return lsm.getMetricsSnapshot();
  }
}

export const storage = new LSMStorage();
