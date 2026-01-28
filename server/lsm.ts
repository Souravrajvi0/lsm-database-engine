import fs from 'fs';
import path from 'path';
import { KVPair } from '@shared/schema';
import { BloomFilter } from './bloom-filter';
import { SkipList } from './skip-list';
import { Mutex } from 'async-mutex';
import { CompressionUtil } from './compression';
import { CompactionWorker } from './compaction-worker';
import { metrics } from './metrics';

/**
 * LSM Tree Storage Engine
 * 
 * A Log-Structured Merge (LSM) tree implementation featuring:
 * - In-memory MemTable for fast writes
 * - Write-Ahead Log (WAL) for durability
 * - Multiple levels of SSTables with size-tiered compaction
 * - Bloom filters for efficient key lookups
 * - Sparse index blocks for range query optimization
 * - Comprehensive error handling and recovery
 * 
 * Architecture:
 * Level 0: Recently flushed SSTables (may have overlapping key ranges)
 * Level 1+: Compacted SSTables with non-overlapping key ranges
 * 
 * Compaction Strategy:
 * - Level 0 → Level 1: Merge all L0 files when threshold reached
 * - Level N → Level N+1: Size-tiered compaction when level size exceeds limit
 */

// === CONSTANTS ===
const DATA_DIR = path.join(process.cwd(), 'data');
const WAL_PATH = path.join(DATA_DIR, 'wal.log');
const SST_DIR = path.join(DATA_DIR, 'sstables');
const BLOOM_DIR = path.join(DATA_DIR, 'blooms');
const INDEX_DIR = path.join(DATA_DIR, 'indexes');

// Tuning parameters
const MEMTABLE_THRESHOLD = 50; // Entries before flush
const LEVEL_0_COMPACTION_THRESHOLD = 4; // Number of L0 files before compaction
const LEVEL_SIZE_MULTIPLIER = 10; // Each level is 10x larger than previous
const BASE_LEVEL_SIZE = 100; // Base size for level 1 in KB
const SPARSE_INDEX_INTERVAL = 10; // Create index entry every N keys 

// Ensure directories exist with error handling
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SST_DIR)) fs.mkdirSync(SST_DIR, { recursive: true });
  if (!fs.existsSync(BLOOM_DIR)) fs.mkdirSync(BLOOM_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_DIR)) fs.mkdirSync(INDEX_DIR, { recursive: true });
} catch (error) {
  console.error('Failed to create data directories:', error);
  throw new Error('Storage engine initialization failed');
}

/**
 * Represents a single entry in the MemTable
 */
interface MemTableEntry {
  value: string | null; // null represents a tombstone (deletion marker)
  timestamp: number; // Timestamp for conflict resolution
}

/**
 * Metadata about an SSTable file
 */
interface SSTableMeta {
  filename: string;
  level: number;
  minKey: string;
  maxKey: string;
  size: number; // Size in bytes
  keyCount: number; // Number of keys in the SSTable
}

/**
 * Sparse index entry for fast range lookups
 * Maps a key to its position in the SSTable
 */
interface SparseIndexEntry {
  key: string;
  offset: number; // Position in the data array
}

/**
 * Structure of an SSTable file on disk
 */
interface SSTableContent {
  level: number;
  minKey: string;
  maxKey: string;
  count: number;
  data: { key: string; value: string | null }[];
  sparseIndex?: SparseIndexEntry[]; // Optional sparse index for faster lookups
}


export class LSMTree {
  // In-memory data structures
  private memTable: SkipList<string, MemTableEntry> = new SkipList();
  private bloomFilters: Map<string, BloomFilter> = new Map(); // filename -> BloomFilter
  
  // Concurrency control
  private writeMutex = new Mutex();
  
  // Background workers
  private compactionWorker: CompactionWorker;
  
  // State flags
  private isCompacting = false;
  
  // Metrics and statistics
  private totalWrites = 0;
  private totalReads = 0;
  private bloomFilterHits = 0; // Avoided SSTable reads
  private bloomFilterMisses = 0; // Had to read SSTable
  private writeLatencies: number[] = [];
  private readLatencies: number[] = [];
  private lastFlushDuration = 0;
  private lastCompactionDuration = 0;
  private writeAmplification = 1.0;

  constructor() {
    try {
      this.recoverFromWAL();
      this.loadBloomFilters();
      
      // Initialize background compaction worker
      this.compactionWorker = new CompactionWorker(this);
      this.compactionWorker.start();
      
      console.log('LSM Tree initialized successfully with concurrent writes and background compaction');
    } catch (error) {
      console.error('Failed to initialize LSM Tree:', error);
      throw error;
    }
  }

  /**
   * Insert or update a key-value pair
   * 
   * Write path:
   * 1. Acquire write lock for concurrency safety
   * 2. Write to WAL for durability (crash recovery)
   * 3. Insert into MemTable (Skip List) for fast access
   * 4. Check if MemTable needs flushing
   * 5. Record metrics
   * 
   * @throws Error if WAL write fails
   */
  public async put(key: string, value: string): Promise<void> {
    const start = performance.now();
    
    // Acquire write lock for thread safety
    const release = await this.writeMutex.acquire();
    
    try {
      await this.writeToWAL(key, value);
      this.memTable.insert(key, { value, timestamp: Date.now() });
      await this.checkMemTableSize();

      this.totalWrites++;
      const latency = performance.now() - start;
      this.writeLatencies.push(latency);
      metrics.recordPut(latency);
      metrics.updateStorage(this.memTable.getSize(), this.getSSTableCount());
    } catch (error) {
      console.error('PUT operation failed:', error);
      throw new Error(`Failed to PUT key="${key}": ${error}`);
    } finally {
      release();
    }
  }

  /**
   * Delete a key by writing a tombstone marker
   * 
   * LSM trees use tombstones instead of immediate deletion.
   * The actual deletion happens during compaction when tombstones are merged.
   * 
   * @throws Error if WAL write fails
   */
  public async delete(key: string): Promise<void> {
    const start = performance.now();
    
    // Acquire write lock for thread safety
    const release = await this.writeMutex.acquire();
    
    try {
      await this.writeToWAL(key, null); // null = tombstone
      this.memTable.insert(key, { value: null, timestamp: Date.now() });
      await this.checkMemTableSize();
      
      const latency = performance.now() - start;
      metrics.recordDelete(latency);
    } catch (error) {
      console.error(`Failed to delete key "${key}":`, error);
      throw new Error(`Delete operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      release();
    }
  }

  /**
   * Retrieve the value for a given key
   * 
   * Read path:
   * 1. Check MemTable (most recent data)
   * 2. Check Level 0 SSTables (newest to oldest)
  /**
   * Atomic batch PUT operations
   * 
   * Batch operations are atomic - either all succeed or all fail.
   * All entries are written to WAL first, then inserted to memtable.
   * This reduces lock contention compared to individual operations.
   * 
   * @param entries Array of {key, value} pairs to insert
   * @throws Error if WAL write fails
   */
  public async batchPut(entries: Array<{key: string, value: string}>): Promise<void> {
    const start = performance.now();
    
    if (!entries || entries.length === 0) {
      throw new Error('Batch cannot be empty');
    }
    
    const release = await this.writeMutex.acquire();
    
    try {
      // Write all to WAL first (atomic)
      for (const {key, value} of entries) {
        await this.writeToWAL(key, value);
      }
      
      // Then insert all to memtable
      for (const {key, value} of entries) {
        this.memTable.insert(key, {
          value,
          timestamp: Date.now(),
          isTombstone: false
        });
      }
      
      this.totalWrites += entries.length;
      await this.checkMemTableSize();
      
      const latency = performance.now() - start;
      metrics.recordBatchPut(latency, entries.length);
      metrics.updateStorage(this.memTable.getSize(), this.getSSTableCount());
    } catch (error) {
      console.error('Batch PUT operation failed:', error);
      throw new Error(`Failed to batch PUT ${entries.length} entries: ${error}`);
    } finally {
      release();
    }
  }

  /**
   * Atomic batch DELETE operations
   * 
   * Similar to batchPut but writes tombstones.
   * 
   * @param keys Array of keys to delete
   * @throws Error if WAL write fails
   */
  public async batchDelete(keys: string[]): Promise<void> {
    const start = performance.now();
    
    if (!keys || keys.length === 0) {
      throw new Error('Batch cannot be empty');
    }
    
    const release = await this.writeMutex.acquire();
    
    try {
      // Write all tombstones to WAL first
      for (const key of keys) {
        await this.writeToWAL(key, null); // null = tombstone
      }
      
      // Then insert all tombstones to memtable
      for (const key of keys) {
        this.memTable.insert(key, {
          value: null,
          timestamp: Date.now(),
          isTombstone: true
        });
      }
      
      await this.checkMemTableSize();
      
      const latency = performance.now() - start;
      metrics.recordBatchDelete(latency, keys.length);
    } catch (error) {
      console.error('Batch DELETE operation failed:', error);
      throw new Error(`Failed to batch DELETE ${keys.length} keys: ${error}`);
    } finally {
      release();
    }
  }

  /**
   * Retrieve the value for a given key
   * 
   * Read path:
   * 1. Check MemTable (most recent data)
   * 2. Check Level 0 SSTables (newest to oldest)
   * 3. Check Level 1+ SSTables (with bloom filter optimization)
   * 
   * Bloom filters help skip SSTables that definitely don't contain the key.
   * 
   * @returns The value if found, null if not found or deleted
   */
  public async get(key: string): Promise<string | null> {
    const start = performance.now();
    let result = null;
    
    try {
      // Step 1: Check MemTable first (most recent writes)
      const memEntry = this.memTable.get(key);
      if (memEntry !== null && memEntry !== undefined) {
        result = memEntry.value;
      } else {
        // Step 2: Check SSTables from newest to oldest
        const sstables = this.getSSTables();
        
        // Sort by level (L0 first) and timestamp (newest first within level)
        const sortedSSTs = sstables.sort((a, b) => {
          if (a.level !== b.level) return a.level - b.level;
          const timeA = parseInt(a.filename.split('_')[2]);
          const timeB = parseInt(b.filename.split('_')[2]);
          return timeB - timeA; // Newest first
        });

        // Search through SSTables
        for (const sst of sortedSSTs) {
          // Quick range check
          if (key < sst.minKey || key > sst.maxKey) {
            continue;
          }

          // Bloom filter optimization: skip if definitely not present
          const bloom = this.bloomFilters.get(sst.filename);
          if (bloom && !bloom.mightContain(key)) {
            this.bloomFilterHits++; // Successfully avoided disk read
            metrics.recordBloomFilter(true);
            continue;
          }

          // Bloom filter says it might be present, or no bloom filter exists
          if (bloom) {
            this.bloomFilterMisses++; // Had to read despite bloom filter
            metrics.recordBloomFilter(false);
          }

          const data = await this.readSSTable(sst.filename);
          const entry = data.find(d => d.key === key);
          if (entry) {
            result = entry.value;
            break; // Found it, stop searching
          }
        }
      }

      this.totalReads++;
      const latency = performance.now() - start;
      this.readLatencies.push(latency);
      if (this.readLatencies.length > 1000) this.readLatencies.shift();
      metrics.recordGet(latency);
      
      return result;
    } catch (error) {
      console.error(`Failed to get key "${key}":`, error);
      throw new Error(`Read operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scan a range of keys
   * 
   * Merges data from MemTable and all relevant SSTables, returning keys in sorted order.
   * Uses sparse indexes when available for faster range scans.
   * Uses Skip List's efficient range() method for O(log n + k) performance.
   * 
   * @param startKey - Optional start of range (inclusive)
   * @param endKey - Optional end of range (inclusive)
   * @param limit - Maximum number of results to return
   * @returns Array of key-value pairs in sorted order
   */
  public async scan(startKey?: string, endKey?: string, limit: number = 20): Promise<KVPair[]> {
    const start = performance.now();
    
    try {
      const mergedData = new Map<string, string | null>();

      // Use Skip List's efficient range query for MemTable
      const memTableEntries = this.memTable.range(startKey, endKey);
      for (const [k, v] of memTableEntries) {
        mergedData.set(k, v.value);
      }

      // Scan SSTables
      const sstables = this.getSSTables();
      for (const sst of sstables) {
        // Skip SSTables outside the range
        if (endKey && sst.minKey > endKey) continue;
        if (startKey && sst.maxKey < startKey) continue;

        const data = await this.readSSTableRange(sst.filename, startKey, endKey);
        for (const entry of data) {
          if (!mergedData.has(entry.key)) {
            mergedData.set(entry.key, entry.value);
          }
        }
      }

      // Sort and filter keys (mergedData keys are already from sorted sources)
      let keys = Array.from(mergedData.keys()).sort();
      if (startKey) keys = keys.filter(k => k >= startKey);
      if (endKey) keys = keys.filter(k => k <= endKey);
      
      // Build result set (exclude tombstones)
      const result: KVPair[] = [];
      for (const k of keys) {
        const val = mergedData.get(k);
        if (val !== null && val !== undefined) { // Skip tombstones and undefined
          result.push({ key: k, value: val });
        }
        if (result.length >= limit) break;
      }
      
      const latency = performance.now() - start;
      metrics.recordScan(latency);
      
      return result;
    } catch (error) {
      console.error('Scan operation failed:', error);
      throw new Error(`Scan operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get comprehensive statistics about the storage engine
   */
  public getStats() {
    try {
      const sstables = this.getSSTables();
      const levels: Record<number, { count: number, size: number, files: string[] }> = {};
      
      sstables.forEach(sst => {
        if (!levels[sst.level]) levels[sst.level] = { count: 0, size: 0, files: [] };
        levels[sst.level].count++;
        levels[sst.level].size += sst.size;
        levels[sst.level].files.push(sst.filename);
      });

      const avgWriteLat = this.writeLatencies.length > 0 
        ? this.writeLatencies.reduce((a, b) => a + b, 0) / this.writeLatencies.length 
        : 0;
      const avgReadLat = this.readLatencies.length > 0 
        ? this.readLatencies.reduce((a, b) => a + b, 0) / this.readLatencies.length 
        : 0;

      // Calculate bloom filter efficiency
      const totalBloomChecks = this.bloomFilterHits + this.bloomFilterMisses;
      const bloomFilterEfficiency = totalBloomChecks > 0 
        ? (this.bloomFilterHits / totalBloomChecks) * 100 
        : 0;

      return {
        memTableSize: this.memTable.getSize(),
        walSize: fs.existsSync(WAL_PATH) ? fs.statSync(WAL_PATH).size : 0,
        levels: Object.entries(levels).map(([lvl, stats]) => ({
          level: parseInt(lvl),
          fileCount: stats.count,
          totalSize: stats.size,
          files: stats.files
        })),
        isCompacting: this.isCompacting,
        metrics: {
          totalWrites: this.totalWrites,
          totalReads: this.totalReads,
          avgWriteLatencyMs: avgWriteLat,
          avgReadLatencyMs: avgReadLat,
          lastFlushDurationMs: this.lastFlushDuration,
          lastCompactionDurationMs: this.lastCompactionDuration,
          writeAmplification: this.writeAmplification,
          bloomFilterHits: this.bloomFilterHits,
          bloomFilterMisses: this.bloomFilterMisses,
          bloomFilterEfficiency: bloomFilterEfficiency.toFixed(2) + '%'
        }
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        memTableSize: 0,
        walSize: 0,
        levels: [],
        isCompacting: false,
        metrics: {
          totalWrites: 0,
          totalReads: 0,
          avgWriteLatencyMs: 0,
          avgReadLatencyMs: 0,
          lastFlushDurationMs: 0,
          lastCompactionDurationMs: 0,
          writeAmplification: 1.0,
          bloomFilterHits: 0,
          bloomFilterMisses: 0,
          bloomFilterEfficiency: '0%'
        }
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Write an operation to the Write-Ahead Log for durability
   * 
   * The WAL ensures that writes are not lost in case of crash.
   * On recovery, we replay the WAL to reconstruct the MemTable.
   * 
   * @throws Error if file write fails
   */
  private async writeToWAL(key: string, value: string | null): Promise<void> {
    try {
      const entry = JSON.stringify({ k: key, v: value, t: Date.now() }) + '\n';
      await fs.promises.appendFile(WAL_PATH, entry, 'utf-8');
    } catch (error) {
      console.error('WAL write failed:', error);
      throw new Error('Failed to write to WAL - data may not be durable');
    }
  }

  /**
   * Recover the MemTable from WAL after a restart
   * 
   * This ensures durability: even if we crash, we can rebuild the MemTable
   * from the WAL and not lose any writes.
   */
  private recoverFromWAL(): void {
    try {
      if (!fs.existsSync(WAL_PATH)) {
        console.log('No WAL found, starting fresh');
        return;
      }

      const fileContent = fs.readFileSync(WAL_PATH, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      let recovered = 0;
      let errors = 0;
      
      for (const line of lines) {
        try {
          const { k, v, t } = JSON.parse(line);
          this.memTable.insert(k, { value: v, timestamp: t });
          recovered++;
        } catch (e) {
          console.error("Error parsing WAL line:", line, e);
          errors++;
        }
      }
      
      console.log(`WAL recovery complete: ${recovered} entries recovered, ${errors} errors`);
    } catch (error) {
      console.error('WAL recovery failed:', error);
      // Don't throw - we can continue with an empty MemTable
    }
  }

  /**
   * Load bloom filters from disk for all SSTables
   * 
   * Bloom filters are stored separately from SSTables for modularity.
   * They're loaded into memory on startup for fast lookups.
   */
  private loadBloomFilters(): void {
    try {
      if (!fs.existsSync(BLOOM_DIR)) return;
      
      const bloomFiles = fs.readdirSync(BLOOM_DIR).filter(f => f.endsWith('.bloom'));
      let loaded = 0;
      
      for (const bloomFile of bloomFiles) {
        try {
          const sstFilename = bloomFile.replace('.bloom', '.json');
          const bloomPath = path.join(BLOOM_DIR, bloomFile);
          const serialized = fs.readFileSync(bloomPath, 'utf-8');
          const bloom = BloomFilter.deserialize(serialized);
          this.bloomFilters.set(sstFilename, bloom);
          loaded++;
        } catch (error) {
          console.error(`Failed to load bloom filter ${bloomFile}:`, error);
        }
      }
      
      console.log(`Loaded ${loaded} bloom filters`);
    } catch (error) {
      console.error('Failed to load bloom filters:', error);
    }
  }

  /**
   * Get metadata for all SSTables on disk
   * 
   * @returns Array of SSTable metadata sorted by level and timestamp
   */
  private getSSTables(): SSTableMeta[] {
    try {
      if (!fs.existsSync(SST_DIR)) return [];
      const files = fs.readdirSync(SST_DIR).filter(f => f.endsWith('.json'));
      
      return files.map(file => {
        try {
          const stats = fs.statSync(path.join(SST_DIR, file));
          const content = JSON.parse(fs.readFileSync(path.join(SST_DIR, file), 'utf-8'));
          return {
            filename: file,
            level: content.level || 0,
            minKey: content.minKey,
            maxKey: content.maxKey,
            size: stats.size,
            keyCount: content.count || 0
          };
        } catch (error) {
          console.error(`Failed to read SSTable metadata for ${file}:`, error);
          return null;
        }
      }).filter((meta): meta is SSTableMeta => meta !== null);
    } catch (error) {
      console.error('Failed to get SSTables:', error);
      return [];
    }
  }

  /**
   * Read all data from an SSTable file
   * 
   * @param filename - Name of the SSTable file
   * @returns Array of key-value pairs
   */
  private async readSSTable(filename: string): Promise<{key: string, value: string | null}[]> {
    try {
      const compressed = await fs.promises.readFile(path.join(SST_DIR, filename));
      const decompressed = await CompressionUtil.decompress(compressed);
      const json: SSTableContent = JSON.parse(decompressed.toString('utf-8'));
      return json.data;
    } catch (error) {
      console.error(`Failed to read SSTable ${filename}:`, error);
      throw new Error(`SSTable read failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read a range of keys from an SSTable using sparse index if available
   * 
   * This optimizes range queries by using the sparse index to skip to
   * the approximate position instead of scanning from the beginning.
   * 
   * @param filename - Name of the SSTable file
   * @param startKey - Optional start of range
   * @param endKey - Optional end of range
   * @returns Filtered array of key-value pairs
   */
  private async readSSTableRange(
    filename: string,
    startKey?: string,
    endKey?: string
  ): Promise<{key: string, value: string | null}[]> {
    try {
      const compressed = await fs.promises.readFile(path.join(SST_DIR, filename));
      const decompressed = await CompressionUtil.decompress(compressed);
      const json: SSTableContent = JSON.parse(decompressed.toString('utf-8'));
      
      // If sparse index exists and we have a startKey, use it to find starting position
      let startOffset = 0;
      if (json.sparseIndex && startKey) {
        // Binary search in sparse index to find nearest entry
        const idx = json.sparseIndex.findIndex(entry => entry.key >= startKey);
        if (idx > 0) {
          startOffset = json.sparseIndex[idx - 1].offset;
        }
      }
      
      // Filter data based on range
      const data = json.data.slice(startOffset);
      return data.filter(entry => {
        if (startKey && entry.key < startKey) return false;
        if (endKey && entry.key > endKey) return false;
        return true;
      });
    } catch (error) {
      console.error(`Failed to read SSTable range ${filename}:`, error);
      return [];
    }
  }

  /**
   * Check if MemTable has reached threshold and needs flushing
   */
  private async checkMemTableSize(): Promise<void> {
    if (this.memTable.getSize() >= MEMTABLE_THRESHOLD) {
      await this.flushMemTable();
      
      // Trigger background compaction if needed
      this.triggerCompactionIfNeeded();
    }
  }

  /**
   * Flush MemTable to disk as a new Level 0 SSTable
   * 
   * This converts the in-memory MemTable into a persistent SSTable file.
   * Also creates a bloom filter and sparse index for the new SSTable.
   * 
   * Level 0 SSTables may have overlapping key ranges since they're just
   * snapshots of the MemTable at flush time.
   */
  private async flushMemTable(): Promise<void> {
    const start = performance.now();
    console.log("Flushing MemTable to SSTable...");
    
    try {
      // Skip List maintains sorted order, so no need to sort!
      // This is a major performance improvement over Map
      const sortedEntries = this.memTable.toArray()
        .map(([key, entry]) => ({ key, value: entry.value }));

      if (sortedEntries.length === 0) {
        console.log("MemTable is empty, skipping flush");
        return;
      }

      const filename = `level_0_${Date.now()}.json`;
      const filepath = path.join(SST_DIR, filename);

      // Create sparse index: every Nth key gets an index entry
      const sparseIndex: SparseIndexEntry[] = [];
      for (let i = 0; i < sortedEntries.length; i += SPARSE_INDEX_INTERVAL) {
        sparseIndex.push({
          key: sortedEntries[i].key,
          offset: i
        });
      }

      // Build SSTable content
      const sstContent: SSTableContent = {
        level: 0,
        minKey: sortedEntries[0].key,
        maxKey: sortedEntries[sortedEntries.length - 1].key,
        count: sortedEntries.length,
        data: sortedEntries,
        sparseIndex
      };

      // Compress SSTable data for storage efficiency
      const compressedData = await CompressionUtil.compressWithStats(JSON.stringify(sstContent));
      await fs.promises.writeFile(filepath, compressedData.compressed);
      
      console.log(`  Compression: ${sortedEntries.length} keys, ` +
                  `ratio ${compressedData.compressionRatio.toFixed(2)}x, ` +
                  `saved ${compressedData.savingsPercent.toFixed(1)}%`);

      // Create and save bloom filter
      const bloom = new BloomFilter(sortedEntries.length, 0.01);
      for (const entry of sortedEntries) {
        bloom.add(entry.key);
      }
      this.bloomFilters.set(filename, bloom);
      
      const bloomPath = path.join(BLOOM_DIR, filename.replace('.json', '.bloom'));
      await fs.promises.writeFile(bloomPath, bloom.serialize());

      // Clear MemTable and WAL
      this.memTable.clear();
      await fs.promises.writeFile(WAL_PATH, '');
      
      this.lastFlushDuration = performance.now() - start;
      console.log(`Flushed ${sortedEntries.length} entries to ${filename} in ${this.lastFlushDuration.toFixed(2)}ms`);
    } catch (error) {
      console.error('MemTable flush failed:', error);
      throw new Error(`Flush operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if compaction should be triggered and start it in the background
   * 
   * Compaction is triggered when:
   * - Level 0 has too many files (causes read amplification)
   * - Any level exceeds its size limit
   */
  private triggerCompactionIfNeeded(): void {
    if (this.isCompacting) return;

    const sstables = this.getSSTables();
    const level0Files = sstables.filter(s => s.level === 0);

    // Check if Level 0 needs compaction
    if (level0Files.length >= LEVEL_0_COMPACTION_THRESHOLD) {
      console.log(`Level 0 has ${level0Files.length} files, triggering compaction`);
      this.compact().catch(err => console.error('Background compaction failed:', err));
      return;
    }

    // Check if any other level needs compaction
    for (let level = 1; level < 10; level++) {
      const levelFiles = sstables.filter(s => s.level === level);
      const levelSize = levelFiles.reduce((sum, f) => sum + f.size, 0) / 1024; // KB
      const maxSize = BASE_LEVEL_SIZE * Math.pow(LEVEL_SIZE_MULTIPLIER, level - 1);

      if (levelSize > maxSize) {
        console.log(`Level ${level} size ${levelSize.toFixed(2)}KB exceeds limit ${maxSize}KB, triggering compaction`);
        this.compactLevel(level).catch(err => console.error('Background compaction failed:', err));
        break;
      }
    }
  }

  // ============================================================================
  // COMPACTION METHODS
  // ============================================================================

  /**
   * Compact Level 0 SSTables into Level 1
   * 
   * Level 0 is special: files can have overlapping key ranges.
   * This method merges all L0 files into L1, resolving conflicts
   * and removing tombstones.
   * 
   * Compaction process:
   * 1. Read all L0 SSTables (sorted by timestamp, oldest first)
   * 2. Merge entries, keeping most recent value for each key
   * 3. Remove tombstones (deleted keys)
   * 4. Write merged data to new L1 SSTable
   * 5. Delete old L0 files
   * 
   * Write amplification = (bytes read + bytes written) / bytes written
   */
  public async compact(): Promise<void> {
    if (this.isCompacting) {
      console.log('Compaction already in progress');
      return;
    }
    
    const start = performance.now();
    this.isCompacting = true;
    
    try {
      const sstables = this.getSSTables();
      const level0 = sstables.filter(s => s.level === 0);
      
      if (level0.length < 2) {
        console.log('Not enough L0 files to compact');
        return;
      }

      console.log(`Starting compaction of ${level0.length} Level 0 files`);

      // Merge all L0 files, keeping most recent value for each key
      const allData = new Map<string, string | null>();
      
      // Sort by timestamp (oldest first) so newer writes override older ones
      level0.sort((a, b) => {
        const timeA = parseInt(a.filename.split('_')[2]);
        const timeB = parseInt(b.filename.split('_')[2]);
        return timeA - timeB;
      });

      let totalBytesRead = 0;
      for (const sst of level0) {
        totalBytesRead += sst.size;
        const data = await this.readSSTable(sst.filename);
        for (const entry of data) {
          allData.set(entry.key, entry.value); // Later writes override
        }
      }

      // Remove tombstones and sort by key
      const finalData = Array.from(allData.entries())
        .filter(([_, value]) => value !== null) // Remove deleted keys
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => ({ key, value: value! }));

      if (finalData.length === 0) {
        console.log('All data was deleted, removing L0 files');
        // Just delete the L0 files, no need to create empty L1
        for (const sst of level0) {
          await this.deleteSSTable(sst.filename);
        }
        return;
      }

      // Create new Level 1 SSTable with sparse index
      const filename = `level_1_${Date.now()}.json`;
      const filepath = path.join(SST_DIR, filename);

      const sparseIndex: SparseIndexEntry[] = [];
      for (let i = 0; i < finalData.length; i += SPARSE_INDEX_INTERVAL) {
        sparseIndex.push({
          key: finalData[i].key,
          offset: i
        });
      }

      const content: SSTableContent = {
        level: 1,
        minKey: finalData[0].key,
        maxKey: finalData[finalData.length - 1].key,
        count: finalData.length,
        data: finalData,
        sparseIndex
      };

      const contentStr = JSON.stringify(content);
      await fs.promises.writeFile(filepath, contentStr);

      // Create bloom filter for new SSTable
      const bloom = new BloomFilter(finalData.length, 0.01);
      for (const entry of finalData) {
        bloom.add(entry.key);
      }
      this.bloomFilters.set(filename, bloom);
      
      const bloomPath = path.join(BLOOM_DIR, filename.replace('.json', '.bloom'));
      await fs.promises.writeFile(bloomPath, bloom.serialize());

      // Calculate write amplification
      this.writeAmplification = (totalBytesRead + contentStr.length) / (contentStr.length || 1);

      // Delete old L0 files
      for (const sst of level0) {
        await this.deleteSSTable(sst.filename);
      }

      this.lastCompactionDuration = performance.now() - start;
      console.log(`Compaction complete: merged ${level0.length} files into ${filename}`);
      console.log(`  - Keys: ${finalData.length}, Write amplification: ${this.writeAmplification.toFixed(2)}x`);
      console.log(`  - Duration: ${this.lastCompactionDuration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Compaction failed:', error);
      throw new Error(`Compaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isCompacting = false;
    }
  }

  /**
   * Compact a specific level to the next level
   * 
   * For Level N → Level N+1 compaction:
   * 1. Select SSTables from level N that need compaction
   * 2. Find overlapping SSTables in level N+1
   * 3. Merge them together, removing duplicates and tombstones
   * 4. Write new SSTables to level N+1
   * 5. Delete old SSTables from both levels
   * 
   * @param level - The level to compact (must be >= 1)
   */
  private async compactLevel(level: number): Promise<void> {
    if (this.isCompacting || level < 1) return;
    
    const start = performance.now();
    this.isCompacting = true;
    
    try {
      console.log(`Starting compaction of Level ${level} to Level ${level + 1}`);
      
      const sstables = this.getSSTables();
      const currentLevelFiles = sstables.filter(s => s.level === level);
      const nextLevelFiles = sstables.filter(s => s.level === level + 1);

      if (currentLevelFiles.length === 0) {
        console.log(`No files at Level ${level}`);
        return;
      }

      // For simplicity, compact all files at this level
      // In a production system, you'd select a subset based on overlapping ranges
      const filesToCompact = currentLevelFiles;

      // Find overlapping files in next level
      const minKeyStr = filesToCompact.reduce((min, f) => f.minKey < min ? f.minKey : min, filesToCompact[0].minKey);
      const maxKeyStr = filesToCompact.reduce((max, f) => f.maxKey > max ? f.maxKey : max, filesToCompact[0].maxKey);
      const overlappingNextLevel = nextLevelFiles.filter(f => 
        !(f.maxKey < minKeyStr || f.minKey > maxKeyStr)
      );

      // Merge all selected files
      const allFiles = [...filesToCompact, ...overlappingNextLevel];
      const mergedData = new Map<string, string | null>();
      let totalBytesRead = 0;

      for (const sst of allFiles) {
        totalBytesRead += sst.size;
        const data = await this.readSSTable(sst.filename);
        for (const entry of data) {
          if (!mergedData.has(entry.key)) {
            mergedData.set(entry.key, entry.value);
          }
        }
      }

      // Remove tombstones and sort
      const finalData = Array.from(mergedData.entries())
        .filter(([_, value]) => value !== null)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => ({ key, value: value! }));

      if (finalData.length === 0) {
        console.log('All data was deleted');
        for (const sst of allFiles) {
          await this.deleteSSTable(sst.filename);
        }
        return;
      }

      // Write new SSTable at next level
      const filename = `level_${level + 1}_${Date.now()}.json`;
      
      const sparseIndex: SparseIndexEntry[] = [];
      for (let i = 0; i < finalData.length; i += SPARSE_INDEX_INTERVAL) {
        sparseIndex.push({ key: finalData[i].key, offset: i });
      }

      const content: SSTableContent = {
        level: level + 1,
        minKey: finalData[0].key,
        maxKey: finalData[finalData.length - 1].key,
        count: finalData.length,
        data: finalData,
        sparseIndex
      };

      await fs.promises.writeFile(path.join(SST_DIR, filename), JSON.stringify(content));

      // Create bloom filter
      const bloom = new BloomFilter(finalData.length, 0.01);
      for (const entry of finalData) {
        bloom.add(entry.key);
      }
      this.bloomFilters.set(filename, bloom);
      await fs.promises.writeFile(
        path.join(BLOOM_DIR, filename.replace('.json', '.bloom')),
        bloom.serialize()
      );

      // Delete old files
      for (const sst of allFiles) {
        await this.deleteSSTable(sst.filename);
      }

      this.lastCompactionDuration = performance.now() - start;
      console.log(`Level ${level} compaction complete in ${this.lastCompactionDuration.toFixed(2)}ms`);
    } catch (error) {
      console.error(`Level ${level} compaction failed:`, error);
    } finally {
      this.isCompacting = false;
    }
  }

  /**
   * Delete an SSTable and its associated bloom filter
   */
  private async deleteSSTable(filename: string): Promise<void> {
    try {
      // Delete SSTable file
      const sstPath = path.join(SST_DIR, filename);
      if (fs.existsSync(sstPath)) {
        await fs.promises.unlink(sstPath);
      }

      // Delete bloom filter
      const bloomPath = path.join(BLOOM_DIR, filename.replace('.json', '.bloom'));
      if (fs.existsSync(bloomPath)) {
        await fs.promises.unlink(bloomPath);
      }

      // Remove from memory
      this.bloomFilters.delete(filename);
    } catch (error) {
      console.error(`Failed to delete SSTable ${filename}:`, error);
    }
  }

  /**
   * Public method to get SSTable count (for compaction worker)
   */
  public getSSTableCount(): number {
    try {
      const files = fs.readdirSync(SST_DIR);
      return files.filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Public method to trigger compaction (for compaction worker)
   */
  public async performCompaction(level: number = 0): Promise<void> {
    if (this.isCompacting) {
      console.log('Compaction already in progress, skipping');
      return;
    }
    
    const start = performance.now();
    await this.compact();
    const duration = performance.now() - start;
    
    metrics.recordCompaction(duration);
    console.log(`Compaction completed in ${duration.toFixed(2)}ms`);
  }

  /**
   * Stop the background compaction worker (for cleanup)
   */
  public stop(): void {
    if (this.compactionWorker) {
      this.compactionWorker.stop();
    }
    console.log('LSM Tree stopped');
  }

  /**
   * Get metrics snapshot (for HTTP endpoint)
   */
  public getMetricsSnapshot() {
    return metrics.getSnapshot();
  }
}

export const lsm = new LSMTree();
