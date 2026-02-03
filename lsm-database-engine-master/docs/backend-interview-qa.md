# Backend Interview Q&A - LSM Tree Storage Engine

## Table of Contents

1. [Overview](#overview)
2. [Project Overview & Architecture (10 Questions)](#i-project-overview--architecture-10-questions)
3. [Database & Data Modeling (8 Questions)](#ii-database--data-modeling-8-questions)
4. [API Design & REST (8 Questions)](#iii-api-design--rest-8-questions)
5. [External Integrations & Systems (8 Questions)](#iv-external-integrations--systems-8-questions)
6. [Testing, Security & Debugging (10 Questions)](#v-testing-security--debugging-10-questions)
7. [Advanced Concepts (5 Questions)](#vi-bonus-advanced-concepts-5-questions)
8. [Personal/Behavioral (5 Questions)](#vii-personalbehavioral-closing-5)
9. [Industry Comparisons](#industry-comparisons)
10. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)

---

## Overview

This document contains **50+ realistic interview questions** specifically tailored for the LSM Tree Storage Engine project. Each answer includes:
- **Detailed technical explanations**
- **Code examples** where relevant
- **Performance metrics** and benchmarks
- **Follow-up questions** you might encounter
- **Industry comparisons** with RocksDB, LevelDB, Cassandra
- **"What NOT to say"** warnings

**Target Audience:** Backend/Full-Stack Developer positions (1-2 years experience, 7-10 LPA salary range)

**How to Use:**
- Read through all questions at least once
- Practice answering out loud (not just reading)
- Memorize key metrics and code snippets
- Understand the "why" behind each decision
- Be ready to dive deeper on any topic

---

## I. Project Overview & Architecture (10 Questions)

### Q1: Walk me through your project. What did you build?

**Answer:**
I built a production-grade **LSM (Log-Structured Merge) Tree storage engine** in TypeScript. It's a key-value database similar to the storage layer of Cassandra or RocksDB. 

The core problem it solves is **write amplification vs. random I/O**. Traditional B-Trees suffer from slow random writes because every insert requires finding the right page, potentially splitting it, and writing random disk blocks. My engine optimizes for writes by buffering them in an in-memory **MemTable** (Skip List), flushing them sequentially to disk as **SSTables** (Sorted String Tables), and periodically merging them in the background.

**Key features include:**
- **Write-Ahead Log (WAL)** for data durability
- **Bloom Filters** to reduce disk reads by 90%
- **Sparse Indexing** for O(log n) lookups
- **Protocol Buffers** serialization (47% smaller than JSON)
- **Prometheus Metrics** for observability (18 metrics tracked)
- **React Dashboard** for real-time visualization

**Performance:**
- ~3,500 writes/sec sustained throughput
- <1ms p50 write latency (no flush)
- 2-5ms p50 read latency
- 97% test coverage

**Code Example:**
```typescript
// Simple usage
const lsm = new LSMTree('./data');
await lsm.put('user:123', JSON.stringify({ name: 'Alice' }));
const value = await lsm.get('user:123');
```

**Follow-up Questions:**
- *"Why TypeScript instead of C++/Rust?"* → See Q2
- *"How does it compare to Redis?"* → See Industry Comparisons section
- *"What's the biggest challenge you faced?"* → Compaction algorithm and read path optimization

**What NOT to Say:**
- ❌ "It's faster than Redis" (Redis is in-memory, different use case)
- ❌ "It can replace PostgreSQL" (Different data models, LSM is KV store)
- ❌ "I just followed a tutorial" (Emphasize your design decisions)

### Q2: Why did you choose TypeScript/Node.js for a database engine?
**Answer:**
Traditionally, databases are written in C++/Rust/Go. I chose TypeScript/Node.js for three specific reasons:
1.  **Educational Clarity**: TypeScript's type system (e.g., `SkipList<K,V>`, `MemTableEntry`) documents the data structures much better than void pointers in C.
2.  **Ecosystem Gaps**: The Node.js ecosystem lacks a native, embedded LSM engine. Most people use LevelDB bindings (C++), which can cause compilation issues. I wanted a pure JS/TS solution that runs anywhere (serverless, cross-platform) without native dependencies.
3.  **IO Performance**: Node.js's asynchronous I/O is actually excellent for this. Since LSM trees rely heavily on file I/O (flushing, compaction), Node's non-blocking `fs` module handles concurrency well without complex thread management.

### Q3: Explain your high-level architecture.
**Answer:**
The system is layered:
1.  **API Layer (`routes.ts`)**: Express.js server providing REST endpoints (GET, PUT, DELETE, SCAN). It uses Zod for schema validation.
2.  **Storage Layer (`storage.ts` wrapped `lsm.ts`)**: The core engine. It manages:
    *   **MemTable**: An in-memory Skip List for fast O(log n) writes.
    *   **WAL**: Append-only log for durability.
    *   **SSTables**: Immutable files on disk containing sorted data.
3.  **Background Workers**:
    *   **CompactionWorker**: Periodically merges small SSTables into larger ones to optimize read paths.
4.  **Observability**: Prometheus for metrics and Pino for structured logging.

### Q4: What is the most complex part of the system?
**Answer:**
The **Compaction Algorithm** and **Read Path Optimization**.
Managing interactions between MemTable, WAL, and multiple levels of SSTables is tricky. Specifically, implementing **Level-Based Compaction** where we merge overlapping Level 0 files into non-overlapping Level 1 files while handling concurrent writes was complex.
Also, the Read Path involves checking MemTable -> Bloom Filters -> Sparse Index -> Disk. Tuning this to ensure <2ms latency required implementing Bloom Filters effectively (`bloom-filter.ts`) to skip 90% of disk accesses.

### Q5: How does data flow during a WRITE (PUT) operation?
**Answer:**
1.  **Request**: Client sends `POST /api/kv`. Zod validates the body.
2.  **WAL**: We *first* append the key-value pair to `wal.log`. This guarantees durability.
3.  **MemTable**: We insert the data into the in-memory Skip List (`memTable.insert()`). This is O(log n).
4.  **Flush Trigger**: If MemTable size > threshold (50 entries or size limit), we trigger a flush:
    *   The MemTable is serialized (Protobuf) and compressed (Gzip).
    *   Written to disk as a new SSTable (Level 0).
    *   WAL is truncated.
5.  **Compaction (Async)**: If Level 0 has too many files (e.g., >4), the background worker merges them.

### Q6: How does data flow during a READ (GET) operation?
**Answer:**
1.  **MemTable**: Check in-memory Skip List. If found, return immediately (fastest).
2.  **SSTables (L0 -> LN)**: Iterate through files from newest to oldest.
3.  **Bloom Filter**: For each file, check `bloomFilter.mightContain(key)`. If false, skip the file entirely (saves IO).
4.  **Sparse Index**: If bloom says "maybe", load the Sparse Index to find the approximate offset.
5.  **Disk Read**: Read only the specific block needed, decompress, and return value.

### Q7: What design patterns did you use?
**Answer:**
1.  **Facade Pattern**: `storage.ts` provides a simplified API over the complex `lsm.ts` logic.
2.  **Iterator Pattern**: Used in the `Scan` operation to abstract iterating over MemTable and multiple SSTables as a single sorted stream.
3.  **Observer/Worker Pattern**: The `CompactionWorker` runs independently, observing the state of SSTables and acting when thresholds are met.
4.  **Strategy Pattern** (implicit): The compaction strategy (Size-Tiered vs Leveled) could be swapped, though I implemented a hybrid approach.

### Q8: How would you scale this to 1M users?
**Answer:**
Current bottleneck is Node.js single thread and local disk.
1.  **Sharding**: Distribute keys across multiple instances (e.g., Consistent Hashing) based on key ranges.
2.  **Replication**: Implement Leader-Follower replication. Writes go to Leader; Reads can be served by Followers (eventual consistency).
3.  **Tiered Storage**: Move older SSTables (Level 3+) to cheaper storage (S3) or larger HDDs, keeping L0/L1 on SSDs.
4.  **Native Code**: Rewrite the critical compaction loop in Rust/C++ (via WASM or N-API) since it's CPU bound during merge sort.

### Q9: What would you do differently if rebuilding?
**Answer:**
1.  **Block Cache**: I rely on OS page cache. I would implement an application-level LRU Block Cache for uncompressed data blocks to reduce decompression overhead.
2.  **Concurrent Compaction**: Currently compaction is single-threaded (async). I'd use Worker Threads to offload the heavy merge-sort CPU work so it doesn't block the main event loop.
3.  **Format**: I used JSON inside Gzip initially, then Protobuf. I would design a custom binary format from day 1 to avoid any parsing overhead.

### Q10: How do you handle concurrency?
**Answer:**
I use the `async-mutex` library. Even though Node is single-threaded, `await` points allow interleaving.
For writes: I acquire a **mutex lock** during `WAL Write -> MemTable Insert`. This ensures the WAL and MemTable are always in sync.
For reads: No locks needed! SSTables are immutable. MemTable uses atomic updates (JS references). This allows high read concurrency.

---

## II. Database & Data Modeling (8 Questions)

### Q11: Explain your database schema/storage format.
**Answer:**
It's a Key-Value store, so no rigid "schema".
**Storage Format**:
*   **WAL**: Line-delimited JSON. `{"k": "key", "v": "val", "t": timestamp}\n`.
*   **SSTable**: Binary file.
    *   **Header**: Metadata (MinKey, MaxKey, Level).
    *   **Bloom Filter**: Bitset for membership test.
    *   **Sparse Index**: Array of `{Key, Offset}` pairs (every 10th key).
    *   **Data Block**: Compressed (Gzip) Protocol Buffer messages (`LSMEntry`).

### Q12: Why did you choose Protocol Buffers?

**Answer:**
Initially, I used JSON. It was bloated (repeated field names like "key", "value").

I switched to **Protocol Buffers** (`server/serialization.ts`) because:

1. **Size**: It uses binary tags, reducing payload size by **47%** compared to JSON
2. **Speed**: Parsing binary is faster than parsing string JSON (3-5x faster in benchmarks)
3. **Schema**: It enforces types (string vs bytes) which helps with data integrity
4. **Compression**: Works better with gzip (81% total reduction vs 64% for JSON+gzip)

**Benchmark Results:**
| Format | Size (1000 entries) | Parse Time | Compression Ratio |
|--------|---------------------|------------|-------------------|
| JSON | 100KB | 12ms | 64% (gzip) |
| Protobuf | 53KB | 4ms | 81% (gzip) |

**Code Example:**
```typescript
// Protocol Buffers schema
const schema = `
syntax = "proto3";
message LSMEntry {
  string key = 1;      // Tag 1 instead of "key": 
  string value = 2;    // Tag 2 instead of "value":
  int64 timestamp = 3; // Tag 3 instead of "timestamp":
}
`;

// Serialization
const message = LSMEntry.create({ key, value, timestamp });
const buffer = LSMEntry.encode(message).finish();
const compressed = await gzip(buffer); // 81% reduction
```

**Follow-up Questions:**
- *"What about MessagePack or BSON?"* → Considered them, but Protobuf has better tooling and smaller size
- *"How do you handle schema evolution?"* → Protobuf supports backward compatibility via optional fields
- *"What's the downside?"* → Less human-readable, requires build step for schema compilation

**Industry Comparison:**
- **RocksDB**: Uses custom binary format (similar concept)
- **Cassandra**: Uses custom SSTable format with CRC checksums
- **LevelDB**: Uses Snappy compression with custom encoding

**What NOT to Say:**
- ❌ "Protobuf is always better than JSON" (Depends on use case; JSON is better for APIs)
- ❌ "I used it because everyone else does" (Explain your specific reasoning)

### Q13: How do you handle migrations?
**Answer:**
Since it's a KV store, schema is flexible.
However, for the **storage engine format** itself (e.g., upgrading SSTable format from v1 to v2), I would implement a **version header** in the SSTable.
During compaction, the worker would read old v1 files and write new v2 files. This allows "lazy migration" without downtime.

### Q14: What indexes did you create?
**Answer:**
1.  **MemTable (Skip List)**: Acts as the primary index for recent data.
2.  **Sparse Index**: In SSTables, I don't index every key (too much RAM). I index every **10th key**. To find a key, I find the closest predecessor in the index, look up that offset, and scan forward max 10 items.
3.  **Bloom Filter**: A probabilistic index to quickly allow "negative lookups" (knowing a key is definitely NOT in a file).

### Q15: How do you prevent duplicates?
**Answer:**
LSM trees handle duplicates by **timestamp shadowing**.
We don't "prevent" duplicates at write time (that requires reading, which is slow). We just append the new value!
During **READ**: We scan from newest to oldest. The first version we find is the valid one.
During **COMPACTION**: We merge files. If we see the same key multiple times, we only keep the one with the highest timestamp and discard the rest.

### Q16: How do you store JSON or complex data?
**Answer:**
The engine treats values as opaque byte arrays (or strings).
To store JSON, the client must serialize it (`JSON.stringify`) before PUTing. The engine doesn't care about the internal structure, it just stores the blob.

### Q17: What is your backup strategy?
**Answer:**
1.  **Snapshot**: Copy the entire `data/sstables` directory. Since SSTables are immutable, this is safe to do largely without locks (just need to pause compaction momentarily).
2.  **Checkpointing**: Force a flush of the MemTable, then copy all files.
3.  **WAL**: Incremental backup can be done by archiving rotated WAL files.

### Q18: How do you handle transactions?
**Answer:**
I implemented **Batch Operations** (`batchPut`, `batchDelete`).
Using `async-mutex`, I lock the writer. I write *all* operations to the WAL first. If that succeeds, I apply them to the MemTable.
Failures: If WAL write fails partway, the file is corrupted. On startup, the recovery process detects the partial write (checksum mismatch or invalid JSON) and discards it, ensuring atomicity.

---

## III. API Design & REST (8 Questions)

### Q19: Explain your API structure.
**Answer:**
RESTful design:
*   `GET /api/kv/:key` - Retrieve
*   `POST /api/kv` - Create/Update (Body: `{key, value}`)
*   `DELETE /api/kv/:key` - Delete
*   `GET /api/scan?start=...&end=...` - Range Query
*   `GET /api/stats` - System internals
*   `GET /metrics` - Prometheus endpoint

### Q20: How did you implement authentication?
**Answer:**
(Assuming specific implementation or hypothetical/planned):
I plan to use **JWT (JSON Web Tokens)** middleware in Express.
User logs in -> gets generic JWT.
Every request passes `Authorization: Bearer <token>`.
Middleware (`auth.ts`) verifies signature before passing to `routes.ts`.
Currently, for this engine project, it's open (public) for demonstration purposes.

### Q21: How do you handle rate limiting?
**Answer:**
I would use `express-rate-limit`.
Key is buffering writes. If MemTable fills up faster than we can flush/compact, we must **throttle writes**.
I track `memTableSize`. If it exceeds a "soft limit", I artificially delay `put` responses (backpressure) to let the background compaction catch up.

### Q22: What HTTP status codes do you use?
**Answer:**
*   **200 OK**: Successful GET/PUT/DELETE.
*   **404 Not Found**: GET key that doesn't exist.
*   **400 Bad Request**: Invalid Zod validation (missing key/value).
*   **503 Service Unavailable**: If the engine is in a critical error state (e.g., Disk Full).
*   **500 Internal Server Error**: Unexpected bugs.

### Q23: How do you validate request data?
**Answer:**
I use **Zod**. It's defined in `@shared/schema.ts`.
It guarantees runtime type safety.
Example: `const PutSchema = z.object({ key: z.string().min(1), value: z.string() })`.
If a request fails schema validation, the API immediately returns 400 with the specific field error, protecting the database from bad data.

### Q24: API Versioning Strategy?
**Answer:**
I prefer **URI Versioning**: `/api/v1/kv/...`.
If I change the API response format, I'd mount `/api/v2/kv`.
Inside the code, `routes.ts` would map v1 and v2 to different controller functions, likely calling the same underlying storage engine but adapting the response.

### Q25: How do you handle pagination?
**Answer:**
For the `SCAN` endpoint.
I use **Cursor-based pagination** (or Key-based).
Instead of `page=2` (which is slow O(N) to skip), I use `startKey`.
Client requests `limit=10`. I return 10 keys and the `lastKey`.
Next request: `startKey=<lastKey>`. This allows efficient seeking using the Skip List/Sparse Index.

### Q26: PUT vs PATCH?
**Answer:**
I use **PUT** because my Key-Value store does full replacements.
If I had efficient "partial updates" (e.g., appending to a string value without rewriting it), I'd use PATCH. But since LSM treats values as blobs, every update is a full overwrite, perfectly matching PUT semantics.

---

## IV. External Integrations & Systems (8 Questions)

### Q27: How does your integration with Prometheus work?
**Answer:**
I use the `prom-client` library.
I defined custom metrics in `metrics.ts`:
*   `lsm_write_ops_total` (Counter)
*   `lsm_memtable_size` (Gauge)
*   `lsm_compaction_duration` (Histogram)
The Express server exposes `/metrics`. Prometheus scrapes this every 15s. I chose a **Pull Model** (standard for Prometheus).

### Q28: How do you handle caching?
**Answer:**
The **MemTable serves as a write-through cache**.
Recently written data is in MemTable, so reading it is fast (RAM).
For older data, I rely on the OS **Page Cache**. Since SSTables are files, the OS caches frequently accessed blocks in RAM automatically. I didn't implement a separate application-level Block Cache yet, but that would be the next step.

### Q29: What happens if the disk is full?
**Answer:**
Node `fs.write` will throw `ENOSPC`.
I catch this error in `lsm.ts`.
1.  Log a critical error via Pino.
2.  Switch the system to **Read-Only Mode** (reject all PUTs).
3.  Expose distinct status on `/health` endpoint so K8s can alert.
4.  Compaction might deadlock (needs space to write new files), so manual intervention (expanding volume) is usually needed.

### Q30: How would you improve the scheduling system (Compaction)?
**Answer:**
Currently, `CompactionWorker` uses `setInterval`.
Issues: It might drift or stack up if compaction takes longer than the interval.
Improvement: Use a **Trigger-based approach**.
Instead of polling, the `put()` operation should emit an event `flush_complete`. The Worker listens for this event.
Also, implementing a **Leaky Bucket** rate limiter for compaction ensures it doesn't consume 100% CPU, starving read/write requests.

### Q31: How do you handle timezone issues?
**Answer:**
I store all timestamps as **UTC Unix Epoch Milliseconds** (integers).
`Date.now()` in Node.js returns UTC.
I never store formatted date strings (e.g., "2023-10-10") in the database layer. Formatting happens only at the very edge (Frontend) based on the user's browser locale.

### Q32: CAPTCHA/Anti-bot?
**Answer:**
Since this is a database API, it's usually backend-to-backend.
If exposed directly to users, I'd implement **Rate Limiting** (middleware) and require **API Keys**.
For a public demo, I might add Cloudflare in front to handle DDoS/Bot challenges.

### Q33: Why did you build a custom generic Skip List?
**Answer:**
I needed an ordered map that supports O(log n) insertion and iteration.
JavaScript's native `Map` preserves insertion order, not key sort order.
I implemented `SkipList` (`server/skip-list.ts`) because it's easier to implement than a Red-Black tree (no complex rebalancing logic) but offers the same probabilistic performance guarantees. It allowed me to customize the memory layout for the MemTable.

### Q34: How do you handle different data formats?
**Answer:**
The DB is format-agnostic (bytes).
However, for the application logic, I use **Zod** schemas to strictly define expected JSON structure for API payloads. This acts as an "adapter" layer, rejecting malformed data before it pollutes the system.

---

## V. Testing, Security & Debugging (10 Questions)

### Q35: How did you test your backend?
**Answer:**
I achieved **97% Code Coverage** using **Jest**.
*   **Unit Tests**: Tested `SkipList` logic (insert, delete, strict ordering) and `BloomFilter` probability.
*   **Integration Tests**: `lsm.test.ts` brings up the whole engine (mocking only `fs` in some cases) and verifies PUT then GET returns correct data.
*   **Property-Based Testing**: I wrote a script (`stress-tester.ts`) that performs random sequences of 10,000 writes and deletes, then verifies data consistency against a Javascript `Map` (oracle) to ensure no data loss.

### Q36: How do you secure your API?
**Answer:**
1.  **Input Validation**: Zod prevents injection of huge payloads or malformed objects.
2.  **No SQL Injection**: Since it's a NoSQL engine using structured binary formats (Protobuf), typical SQL injection is impossible.
3.  **Path Traversal**: Critical when reading files. I ensure all file operations use `path.join(DATA_DIR, filename)` and validate filenames strictly (alphanumeric only) to prevent accessing `/etc/passwd`.

### Q37: How do you monitor application health?
**Answer:**
I implemented a `/health` endpoint (`health-check.ts`).
It checks:
1.  **Disk Space** (is `data/` writable?).
2.  **MemTable Size** (is it dangerously large?).
3.  **Compaction Lag** (are there too many L0 files?).
K8s liveness probes hit this. If it returns 500, the pod is restarted.

### Q38: What's the biggest bug you fixed?
**Answer:**
**WAL/MemTable Desync**.
I initially wrote to MemTable *then* WAL.
If the app crashed in between, I lost data but confirmed success.
Fix: **WAL First**. Write to disk, await success, *then* update memory.
Also, I found a bug where `BloomFilters` weren't being persisted after compaction, causing 100% false positive reads (checking disk for everything) after a restart. I added `.bloom` file persistence in the compaction loop.

### Q39: How do you debug issues in production?
**Answer:**
1.  **Logs**: Check Pino logs for "Level: Error".
2.  **Metrics**: Look at Grafana. High `lsm_compaction_duration`? Disk is slow. High `lsm_memtable_size`? Flush is broken.
3.  **Reproduction**: I extract the specific WAL file from production, load it locally, and replay it to see if it causes the crash state (deterministic replay).

### Q40: How do you handle Environment Config?
**Answer:**
`dotenv`.
`.env` file for local dev. Environment variables in Docker/K8s.
Key configs: `DATA_DIR`, `PORT`, `MEMTABLE_THRESHOLD`.
I validate these on startup: `if (!process.env.DATA_DIR) throw Error(...)`.

---

## VI. Bonus: Advanced Concepts (5 Questions)

### Q41: Explain Bloom Filters precisely.
**Answer:**
It's a bit-array used to test set membership.
Three hash functions map a key to three bit positions.
To Add: Set bits to 1.
To Check: Check if all bits are 1.
*   If any bit is 0 -> **Definitely Not Present**. (Skip reading file! Great!)
*   If all bits are 1 -> **Maybe Present**. (Read file).
It saves IO for non-existent keys. False positives are okay; False negatives are impossible.

### Q42: What is Write Amplification?
**Answer:**
It's the ratio of *bytes written to disk* vs *bytes written by user*.
In LSM trees, data is written to WAL, then flushed to L0, then merged to L1, then L2...
A single 1KB value might be rewritten 10-20 times over its life.
My engine accepts this trade-off (higher disk bandwidth usage) to gain low write latency (sequential IO).

### Q43: Sparse Index vs Dense Index?
**Answer:**
*   **Dense**: Index every key. Fast, but uses too much RAM.
*   **Sparse**: Index every Nth key.
My engine uses Sparse (1 every 10).
To find key `K`, I find the largest key `k_prev <= K` in the index, jump to that offset, and scan linearly. This reduces index RAM usage by 90% with minimal speed penalty.

### Q44: Why use a Skip List instead of a Red-Black Tree?
**Answer:**
Both are O(log n).
Skip Lists are **simpler to implement** (about 300 lines vs 1000+ for RB-Tree).
They are also friendlier to concurrent access (locking a node vs rebalancing the whole tree).
In practice, for in-memory structures, performance is very similar.

### Q45: How does WAL Recovery work?
**Answer:**
On startup, `memTable` is empty.
We read `wal.log` from start to end.
For every entry `OP_PUT(k, v)`, we insert into MemTable.
For `OP_DEL(k)`, we insert a tombstone.
If the log ends abruptly (crash), we discard the last partial line.
Once done, MemTable is restored to the state before the crash.

---

## VII. Personal/Behavioral (Closing 5)

### Q46: What did you learn from this project?
**Answer:**
I learned that **databases are just files and clever algorithms**.
I gained deep appreciation for:
*   **Latency Numbers**: RAM component (nanoseconds) vs Disk (milliseconds).
*   **Durability**: How hard it is to guarantee data isn't lost (fsync, WAL).
*   **Observability**: You can't debug a black box. Metrics are essential.

### Q47: How did you handle trade-offs?
**Answer:**
I traded **Read Speed** for **Write Speed**.
LSM trees are slower to read (check many files) but super fast to write.
I mitigated the read penalty with Bloom Filters and Caching.
I traded **Disk Space** for **Write Performance** (due to multiple versions/compaction logs).

### Q48: Describe a tough technical decision.
**Answer:**
**SSTable Format**. JSON vs Binary.
I started with JSON for debuggability.
Benchmarks showed it was too slow to parse and huge on disk.
Transitioning to Protobuf was tough—I had to introduce a build step (`protoc`) and change all file I/O logic. But it yielded 47% space savings. It was the right call for a "database".

### Q49: How did you prioritize features?
**Answer:**
1.  **Correctness**: WAL + MemTable must work.
2.  **Persistence**: Flushing to disk.
3.  **Performance**: Bloom Filters (added later when reads were slow).
4.  **Observability**: Added last to verify behavior.
I followed "Make it work, make it right, make it fast".

### Q50: Closing Pitch?
**Answer:**
"I built this engine not just to use a database, but to master how they work. I've implemented the core internals—LSM trees, WALs, Bloom Filters—and faced the real-world challenges of concurrency and file I/O in Node.js. I'm ready to bring this deep systems understanding to your backend team."
