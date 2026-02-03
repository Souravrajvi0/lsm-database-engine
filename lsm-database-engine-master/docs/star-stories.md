# STAR Method Stories (Behavioral) - LSM Tree Storage Engine

## Table of Contents

1. [Overview](#overview)
2. [Technical Skills Stories](#technical-skills-4-stories)
3. [Problem Solving Stories](#problem-solving-3-stories)
4. [Learning & Growth Stories](#learning--growth-3-stories)
5. [Collaboration Stories](#collaboration-2-stories)
6. [Additional Stories for Common Scenarios](#additional-stories-for-common-scenarios)
7. [Quick Reference Guide](#quick-reference-guide)

---

## Overview

This document contains **15+ STAR method stories** for behavioral interviews, all based on the LSM Tree Storage Engine project. Each story follows the STAR format:
- **Situation**: Context and background
- **Task**: Your specific responsibility
- **Action**: What you did (with code examples and metrics)
- **Result**: Quantifiable outcomes
- **What I Learned**: Reflection and growth

**How to Use:**
- Memorize 5-7 core stories
- Practice telling them out loud (2-3 minutes each)
- Be ready to adapt stories to different questions
- Always include specific metrics and code examples

---

## Technical Skills (4 Stories)

### 1. Solving a Complex Technical Problem (Read Latency)

**Situation:**  
My LSM engine had great write speeds (3k/sec) but read performance degraded as data grew. Fetching a non-existent key took **20ms** because it had to check every SSTable file on disk. For a database, this was unacceptable—users expect sub-5ms latency.

**Task:**  
I needed to reduce read latency for "misses" (keys that don't exist) to under **2ms** without consuming excessive RAM or slowing down writes.

**Action:**
1. **Researched** probabilistic data structures and selected **Bloom Filters** after reading the original paper and RocksDB source code
2. **Calculated** optimal parameters using the formula: `m = -n*ln(p) / (ln(2)²)` for 1% false positive rate
3. **Implemented** a custom BitArray class in TypeScript using `Uint8Array` for memory efficiency
4. **Integrated** FNV-1a hashing with multiple seeds (k=7 hashes per key) to minimize false positives
5. **Serialized** bloom filters to disk (`.bloom` files) alongside SSTables for persistence
6. **Tested** with 10,000 random lookups to measure improvement

**Code Example:**
```typescript
class BloomFilter {
  private bitArray: Uint8Array;
  private numHashes: number;
  
  constructor(expectedItems: number, falsePositiveRate: number = 0.01) {
    // Calculate optimal size: m = -n*ln(p) / (ln(2)²)
    this.size = Math.ceil(
      (-expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2)
    );
    this.numHashes = Math.ceil((this.size / expectedItems) * Math.log(2));
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }
  
  mightContain(key: string): boolean {
    const hashes = this.getHashes(key);
    for (const hash of hashes) {
      if (!this.getBit(hash % this.size)) {
        return false; // Definitely not present!
      }
    }
    return true; // Might be present
  }
}
```

**Result:**
- Read latency for non-existent keys dropped from **20ms to 0.2ms** (99% reduction)
- Disk reads were completely avoided for **90%** of requests
- Bloom filter overhead was only **1.2KB per 1000 keys** (negligible)
- False positive rate stayed at **1%** as designed

**What I Learned:**
- Probabilistic data structures can provide massive performance wins with minimal space overhead
- The math behind bloom filters (optimal m and k values) is crucial—wrong parameters would waste space or hurt performance
- Sometimes the best optimization is avoiding work entirely (skipping disk reads)

---

### 2. Improving Performance (Compaction Bottleneck)

**Situation:**  
As data grew, the system paused for **seconds** at a time. Users would send a PUT request and it would hang. I realized synchronous compaction (merging files) was blocking the main thread, causing write stalls.

**Task:**  
Decouple compaction from user requests to maintain smooth **p99 latency < 10ms** even during heavy compaction.

**Action:**
1. **Profiled** with Chrome DevTools and found compaction was taking 300-500ms and blocking the event loop
2. **Refactored** compaction logic into a separate `CompactionWorker` class
3. **Implemented** a state-machine based approach where the worker polls for thresholds every 5 seconds
4. **Used** `setImmediate()` in the merge loop to yield control back to the event loop every 100 items
5. **Added** metrics to track compaction duration and L0 file count
6. **Tested** with continuous write load (1000 writes/sec for 10 minutes) to verify no stalls

**Code Example:**
```typescript
class CompactionWorker {
  private interval: NodeJS.Timeout;
  
  start() {
    this.interval = setInterval(() => {
      this.checkAndCompact();
    }, 5000); // Non-blocking poll every 5s
  }
  
  private async checkAndCompact() {
    if (this.lsm.isCompacting) return; // Prevent concurrent compaction
    
    const l0Files = await this.lsm.getSSTables(0);
    if (l0Files.length >= 4) {
      await this.lsm.compact(); // Async, doesn't block writes
    }
  }
}

// Inside merge loop: yield to event loop
for (let i = 0; i < entries.length; i++) {
  merged.push(entries[i]);
  if (i % 100 === 0) {
    await new Promise(resolve => setImmediate(resolve)); // Yield!
  }
}
```

**Result:**
- Write stalls were **eliminated**—p99 write latency stabilized at **2.1ms**
- System could handle continuous load without "stop-the-world" pauses
- Compaction still completed in **150-300ms** but didn't block user requests
- Added Prometheus metric `compaction_duration_seconds` to monitor

**What I Learned:**
- In Node.js, even async operations can block if they're CPU-intensive
- `setImmediate()` is crucial for yielding control in long-running operations
- Background workers should be decoupled from user-facing operations
- Monitoring is essential—without metrics, I wouldn't have found this issue

---

### 3. Scalable Architecture (Serialization)

**Situation:**  
JSON file sizes were huge. A 50MB raw data dump resulted in **120MB** on disk due to repeated field names in JSON (`{"key": "a", "value": "b"}` repeated 1000 times). This was wasting disk space and slowing down I/O.

**Task:**  
Implement a storage-efficient binary format to reduce disk usage by at least **40%** without sacrificing read/write performance.

**Action:**
1. **Evaluated** alternatives: JSON, BSON, MessagePack, Protocol Buffers, custom binary
2. **Chose** Protocol Buffers for schema enforcement, tooling, and size efficiency
3. **Defined** `.proto` schema with strict types matching TypeScript interfaces
4. **Implemented** serialization/deserialization with `protobufjs` library
5. **Added** Gzip compression on top of Protobuf for additional savings
6. **Benchmarked** with 1000-entry SSTables to measure improvement

**Code Example:**
```typescript
// Protocol Buffers schema
const schema = `
syntax = "proto3";
message LSMEntry {
  string key = 1;      // Tag 1 (1 byte) instead of "key": (5 bytes)
  string value = 2;    // Tag 2 instead of "value":
  int64 timestamp = 3; // Tag 3 instead of "timestamp":
}
`;

// Serialization
async function serializeSSTable(data: SSTableData): Promise<Buffer> {
  const message = SSTableMessage.create(data);
  const buffer = SSTableMessage.encode(message).finish(); // Protobuf
  const compressed = await gzip(buffer); // Gzip on top
  return compressed;
}
```

**Benchmark Results:**
| Format | Size (1000 entries) | Compression Ratio |
|--------|---------------------|-------------------|
| JSON | 100KB | Baseline |
| JSON + Gzip | 36KB | 64% reduction |
| Protobuf | 53KB | 47% reduction |
| **Protobuf + Gzip** | **19KB** | **81% reduction** |

**Result:**
- Disk usage dropped by **81%** (100KB → 19KB per SSTable)
- Throughput increased because fewer bytes needed to be written to disk
- Parsing speed improved **3-5x** (binary vs text JSON)
- Total disk savings: **~500MB** for 1M records

**What I Learned:**
- Binary formats are worth the complexity for storage systems
- Compression stacks—Protobuf + Gzip is better than either alone
- Schema enforcement prevents data corruption (caught several bugs during migration)
- Build steps (protoc compiler) are acceptable for production systems

---

### 4. Complex Feature (Range Scans)

**Situation:**  
Key-Value stores usually only support exact lookup (`GET key`). I needed `SCAN` (range query) capability for the dashboard to show "all users" or "keys from A to Z". This is complex because data is spread across multiple disjoint files.

**Task:**  
Implement efficient range scanning over multiple SSTables without loading all data into memory.

**Action:**
1. **Implemented** a **Sparse Index** (stores offset for every 10th key) to avoid indexing every key
2. **Built** a **Merged Iterator** that opens the MemTable and relevant SSTables simultaneously
3. **Performed** K-way merge sort on the fly to yield keys in sorted order
4. **Used** sparse index to seek to approximate position, then linear scan 10 keys
5. **Added** `limit` parameter for pagination (cursor-based, not offset-based)
6. **Tested** with 100K records to verify correctness and performance

**Code Example:**
```typescript
async *scan(startKey: string, endKey: string, limit: number) {
  // Collect iterators from MemTable and SSTables
  const iterators = [
    this.memTable.range(startKey, endKey),
    ...await this.getSSTables().map(sst => this.scanSSTable(sst, startKey, endKey))
  ];
  
  // K-way merge sort
  let count = 0;
  while (count < limit) {
    const min = this.findMinKey(iterators);
    if (!min || min.key > endKey) break;
    
    yield { key: min.key, value: min.value };
    count++;
  }
}

// Sparse index usage
private async scanSSTable(sstable: SSTable, startKey: string, endKey: string) {
  // Binary search sparse index to find starting offset
  const offset = this.sparseIndex.findOffset(startKey); // O(log n)
  
  // Linear scan from offset (max 10 keys to find exact match)
  const entries = await this.readSSTableFromOffset(sstable, offset);
  return entries.filter(e => e.key >= startKey && e.key <= endKey);
}
```

**Result:**
- Enabled `SELECT * WHERE key > X` capability
- Sparse Index kept RAM usage low (**<5MB for 1M keys**) vs **50MB** for dense index
- Range query latency: **12ms for 100 items** (acceptable for dashboard)
- Scan performance: **86% faster** than full linear scan

**What I Learned:**
- Sparse indexes are a great trade-off—90% RAM savings for minimal performance cost
- K-way merge is a fundamental algorithm for distributed systems
- Pagination should be cursor-based (startKey) not offset-based (page numbers)

---

## Problem Solving (3 Stories)

### 5. Debugging Production Bug (WAL Corruption)

**Situation:**  
During a stress test crash (simulated power loss), the database refused to restart. The error was `SyntaxError: Unexpected token in JSON` when reading the WAL file. The last line was half-written: `{"k":"user:123","v":"Al`

**Task:**  
Make the recovery process robust against crashes that happen mid-write.

**Action:**
1. **Analyzed** the WAL format—line-delimited JSON with newline separator
2. **Realized** that `fs.appendFile` is not atomic—crash can happen mid-write
3. **Wrote** a recovery script that reads the WAL line-by-line with error handling
4. **Added** `try-catch` block inside the parsing loop to handle malformed lines
5. **Logged** a warning for corrupted lines and stopped recovery at that point
6. **Tested** by manually corrupting WAL files and verifying recovery

**Code Example:**
```typescript
private async recoverFromWAL(): Promise<void> {
  const walContent = await fs.promises.readFile(this.walPath, 'utf8');
  const lines = walContent.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue; // Skip empty lines
    
    try {
      const entry = JSON.parse(line);
      this.memTable.insert(entry.k, {
        value: entry.v,
        timestamp: entry.t
      });
    } catch (error) {
      // Corrupted line (crash mid-write)
      console.warn(`WAL corruption detected, stopping recovery at line: ${line}`);
      break; // Preserve valid prefix, discard corrupted tail
    }
  }
  
  console.log(`Recovered ${this.memTable.getSize()} entries from WAL`);
}
```

**Result:**
- System became **crash-resilient**—no manual intervention needed after power loss
- Recovery process now handles partial writes gracefully
- Added unit test that simulates crashes at random points during writes
- **Zero data loss** for all committed writes (WAL-first guarantee)

**What I Learned:**
- File I/O is not atomic by default—crashes can happen mid-write
- Error handling is crucial for recovery code—can't assume data is well-formed
- Testing failure scenarios is as important as testing happy paths
- Logging is essential for debugging production issues

---

### 6. Reliability (Disk Full)

**Situation:**  
The server crashed with `ENOSPC` (No space left on device) during a flush, corrupting the SSTable file. The database was left in an inconsistent state—MemTable was cleared but SSTable was incomplete.

**Task:**  
Handle out-of-disk gracefully without data loss or corruption.

**Action:**
1. **Wrapped** all file system calls in a centralized Error Handler
2. **Monitored** `fs.write` errors and caught `ENOSPC` specifically
3. **Implemented** "Read-Only Mode"—reject all PUTs but allow GETs
4. **Exposed** this state via the `/health` endpoint for Kubernetes alerts
5. **Added** Prometheus metric `disk_space_bytes` to monitor proactively
6. **Tested** by filling disk to 100% and verifying graceful degradation

**Code Example:**
```typescript
private async writeSSTable(filename: string, data: any): Promise<void> {
  try {
    const buffer = await serializeSSTable(data);
    await fs.promises.writeFile(filename, buffer);
  } catch (error) {
    if (error.code === 'ENOSPC') {
      // Disk full - enter read-only mode
      this.readOnlyMode = true;
      console.error('Disk full: entering read-only mode');
      
      // Update health check
      this.healthStatus = 'degraded';
      
      throw new Error('Disk full: cannot write new data');
    }
    throw error; // Re-throw other errors
  }
}

// In PUT handler
async put(key: string, value: string): Promise<void> {
  if (this.readOnlyMode) {
    throw new Error('Database is in read-only mode (disk full)');
  }
  // ... normal write path
}
```

**Result:**
- Prevented data corruption during resource exhaustion
- System degrades gracefully—reads still work, writes fail with clear error
- Kubernetes health check shows `degraded` status, triggering alerts
- Added monitoring to detect disk space issues **before** they cause problems

**What I Learned:**
- Graceful degradation is better than crashing
- Error handling should be specific—different errors need different responses
- Monitoring is essential—detect problems before they become critical
- Health checks should reflect actual system state, not just "up/down"

---

### 7. Constraints (Node.js Single Thread)

**Situation:**  
Compaction (CPU-bound merge sort) was blocking API requests (I/O-bound). During a 300ms compaction, all incoming PUT requests would queue up and timeout.

**Task:**  
Balance CPU tasks with I/O tasks in a single-threaded environment.

**Action:**
1. **Profiled** with Chrome DevTools and found merge sort was blocking event loop
2. **Used** `setImmediate()` in the merge loop to yield control every 100 items
3. **Measured** impact on compaction time (300ms → 350ms, acceptable)
4. **Verified** API requests remained responsive (<10ms latency) during compaction
5. **Documented** this pattern for future CPU-intensive operations

**Code Example:**
```typescript
private async mergeSortedArrays(arrays: Entry[][]): Promise<Entry[]> {
  const merged: Entry[] = [];
  
  for (let i = 0; i < arrays.length; i++) {
    merged.push(...arrays[i]);
    
    // Yield to event loop every 100 items
    if (i % 100 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  
  return merged.sort((a, b) => a.key.localeCompare(b.key));
}
```

**Result:**
- API requests remained responsive (**latency <10ms**) even during massive merge sort
- Compaction time increased slightly (300ms → 350ms, **17% slower**) but acceptable
- Eliminated user-facing timeouts
- Learned a pattern applicable to all CPU-intensive operations in Node.js

**What I Learned:**
- Single-threaded doesn't mean synchronous—can still be responsive
- `setImmediate()` is crucial for long-running CPU tasks
- Trade-offs are necessary—17% slower compaction for 100% uptime is worth it
- Future improvement: Worker Threads for true parallelism

---

## Learning & Growth (3 Stories)

### 8. Learning New Tech (LSM Internals)

**Situation:**  
I knew *how* to use a database (SQL queries, ORMs), but not *how* it worked internally. I wanted to understand the fundamentals of storage engines.

**Task:**  
Build a database from scratch to learn the internals.

**Action:**
1. **Read** the original "LSM Tree" paper by O'Neil et al. (1996)
2. **Studied** LevelDB source code (C++) to understand real-world implementation
3. **Mapped** conceptual components (SSTable, MemTable, WAL) to TypeScript classes
4. **Implemented** each component incrementally (MemTable → WAL → SSTables → Compaction)
5. **Tested** each component thoroughly before moving to the next
6. **Documented** my learnings in a blog post

**Result:**
- Built a working engine with **~1,900 lines of code**
- Deeply understood "Write Amplification" vs "Read Amplification" trade-offs
- Can now explain database internals in interviews with confidence
- Gained appreciation for production databases like PostgreSQL and Cassandra

**What I Learned:**
- Reading papers is hard but valuable—original sources explain the "why"
- Building from scratch is the best way to learn—no shortcuts
- Incremental development prevents overwhelming complexity
- Documentation helps solidify understanding

---

### 9. Technical Decision (Skip List vs Red-Black Tree)

**Situation:**  
I needed an ordered/sorted data structure for MemTable. The two main options were Red-Black Tree and Skip List.

**Task:**  
Choose between Red-Black Tree and Skip List based on implementation complexity and performance.

**Action:**
1. **Prototyped** both implementations (spent 2 days on each)
2. **Measured** performance: both were O(log n), similar in practice
3. **Compared** code complexity: RB-Tree was **1000+ lines** with complex rotation logic, Skip List was **300 lines**
4. **Chose** Skip List for maintainability and probabilistic balancing simplicity
5. **Wrote** comprehensive tests to verify correctness

**Code Complexity:**
- Red-Black Tree: 1000+ lines, 8 rotation cases, difficult to debug
- Skip List: 300 lines, simple probabilistic balancing, easy to understand

**Result:**
- Saved **days of debugging** tree balancing edge cases
- Performance was identical in practice (both O(log n))
- Code is maintainable—can easily add features or fix bugs
- Made the right trade-off: simplicity over theoretical guarantees

**What I Learned:**
- Simpler is often better—probabilistic algorithms can match deterministic ones
- Code complexity is a real cost—harder to maintain and debug
- Prototyping helps make informed decisions
- Performance in practice matters more than theoretical worst-case

---

### 10. Going Above and Beyond (Visualization)

**Situation:**  
The engine was a black box. Hard to see if compaction was actually working or if bloom filters were helping. Debugging required reading logs and metrics.

**Task:**  
Create a visual tool to make the database internals observable.

**Action:**
1. **Built** a **React Dashboard** with real-time visualization
2. **Implemented** WebSocket connection to stream stats every second
3. **Displayed** MemTable size, SSTable distribution by level, active compactions
4. **Added** charts for write/read latency over time
5. **Made** it interactive—can trigger compaction manually, view bloom filter stats

**Features:**
- Real-time MemTable size gauge
- SSTable distribution bar chart (L0, L1, L2...)
- Write/Read latency line charts
- Bloom filter hit rate percentage
- Manual compaction trigger button

**Result:**
- Made debugging **intuitive**—could visually "see" the database breathing (flushing/compacting)
- Caught a bug where bloom filters weren't being persisted (saw 0% hit rate)
- Demo'd the dashboard in interviews—impressed interviewers
- Learned React and WebSockets in the process

**What I Learned:**
- Visualization is powerful for understanding complex systems
- Going beyond requirements shows initiative and passion
- Learning new tech (React) while building is efficient
- Good UX applies to developer tools too, not just user-facing apps

---

## Collaboration (2 Stories)

### 11. Trade-offs (Consistency vs Availability)

**Situation:**  
(Hypothetical team scenario) Team debated whether to use `fsync()` after every write. `fsync()` guarantees durability but costs **5-10ms** per write, reducing throughput from 3,500 to 200 ops/sec.

**Task:**  
Balance durability (consistency) vs performance (availability).

**Action:**
1. **Researched** how production databases handle this (PostgreSQL, Cassandra)
2. **Proposed** a **configuration flag** `sync: true/false` so users can choose
3. **Documented** the trade-offs clearly in the README
4. **Implemented** both modes with clear warnings about data loss risk
5. **Tested** both modes to verify behavior

**Trade-off:**
- `sync: true` → Durability guaranteed, 200 ops/sec
- `sync: false` → 3,500 ops/sec, but data loss on power failure

**Result:**
- Team agreed on configuration approach—flexibility for different use cases
- Documented trade-offs clearly so users make informed decisions
- Learned that there's no "right" answer—depends on requirements
- Default is `sync: true` (safety first)

**What I Learned:**
- Trade-offs are everywhere in systems design
- Configuration flags are a good compromise when there's no clear winner
- Documentation is crucial for helping users understand trade-offs
- Safety should be the default, performance should be opt-in

---

### 12. Process Improvement (CI/CD)

**Situation:**  
Tests were manual and often forgotten before committing code. This led to broken builds and wasted time debugging.

**Task:**  
Automate testing to catch bugs before they reach the main branch.

**Action:**
1. **Set up** a pre-commit hook using `husky` to run `npm test`
2. **Configured** GitHub Actions to run tests on every PR
3. **Added** code coverage reporting with Jest
4. **Required** 95%+ coverage for all new code
5. **Documented** the setup in CONTRIBUTING.md

**Result:**
- Caught **3 regression bugs** before they were committed
- Test coverage increased from 70% to 97%
- Build failures dropped from 30% to 5%
- Team velocity increased—less time debugging, more time building

**What I Learned:**
- Automation saves time in the long run
- Pre-commit hooks are low-effort, high-impact
- Code coverage is a useful metric but not the only one
- Good processes enable good outcomes

---

## Additional Stories for Common Scenarios

### 13. Handling Ambiguity

**Situation:** The LSM tree paper didn't specify exact compaction thresholds (when to trigger compaction).

**Action:** Researched RocksDB defaults, experimented with different thresholds (2, 4, 8 files), measured impact on read/write performance.

**Result:** Chose 4 files as optimal balance—low read amplification, acceptable write amplification.

---

### 14. Time Management

**Situation:** Had 8 weeks to build the project, but scope was large (MemTable, WAL, SSTables, Compaction, API, Dashboard).

**Action:** Prioritized features using MoSCoW method (Must have, Should have, Could have, Won't have). Built MVP first (MemTable + WAL), then added features incrementally.

**Result:** Delivered working MVP in 4 weeks, added optimizations (bloom filters, dashboard) in remaining 4 weeks.

---

### 15. Receiving Feedback

**Situation:** Code review feedback said "compaction is too complex, hard to understand."

**Action:** Refactored compaction into smaller functions with clear names, added comments explaining the algorithm, wrote documentation.

**Result:** Code became more maintainable, easier for others to understand. Learned that code is read more than written.

---

## Quick Reference Guide

| Interview Question | Best Story | Key Metrics |
|--------------------|------------|-------------|
| "Describe a technical challenge" | Story 1 (Read Latency) | 20ms → 0.2ms (99% reduction) |
| "Tell me about a time you improved performance" | Story 2 (Compaction) | Eliminated write stalls |
| "Describe a complex feature you built" | Story 4 (Range Scans) | 86% faster than linear scan |
| "Tell me about a bug you debugged" | Story 5 (WAL Corruption) | Crash-resilient recovery |
| "How do you handle failure scenarios?" | Story 6 (Disk Full) | Graceful degradation |
| "Describe a time you learned something new" | Story 8 (LSM Internals) | Built from scratch |
| "Tell me about a technical decision" | Story 9 (Skip List) | 300 lines vs 1000+ lines |
| "Describe a time you went above and beyond" | Story 10 (Dashboard) | Built React visualization |

---

**Document Version:** 2.0  
**Last Updated:** 2026-02-03  
**Target Audience:** Backend/Full-Stack Developer Interviews (1-2 years experience, 7-10 LPA)  
**Preparation Time:** Memorize 5-7 core stories, practice telling them out loud
