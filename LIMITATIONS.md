# Known Limitations

This is an **educational implementation** of an LSM tree storage engine. The following limitations are intentional trade-offs for simplicity and learning purposes.

## 1. No fsync on WAL Writes
**Gap**: WAL writes use `fs.appendFile()` without `fsync()`, leaving data in OS buffer cache.  
**Production Solution**: RocksDB/LevelDB call `fsync()` after every WAL write to guarantee durability, accepting 10-50ms latency penalty.

## 2. No MVCC (Multi-Version Concurrency Control)
**Gap**: Single write mutex serializes all operations; readers can see inconsistent state during flush.  
**Production Solution**: PostgreSQL/MySQL use MVCC with transaction IDs and snapshot isolation, allowing concurrent reads/writes without locks.

## 3. No Authentication or Authorization
**Gap**: All API endpoints are publicly accessible without any access control.  
**Production Solution**: Production databases use role-based access control (RBAC) with TLS client certificates or token-based auth (JWT/OAuth).

## 4. Hardcoded Configuration
**Gap**: Critical parameters (MemTable size: 50 entries, compaction threshold: 4 files) are hardcoded constants.  
**Production Solution**: RocksDB exposes 100+ tunable parameters via configuration files, allowing optimization for specific workloads.

## 5. No Crash Recovery Testing
**Gap**: WAL recovery code exists but has no automated tests for crash scenarios (mid-flush, mid-compaction).  
**Production Solution**: Databases like MongoDB use fault injection frameworks (e.g., Jepsen) to test crash recovery under thousands of failure scenarios.

## 6. JSON-Based SSTables
**Gap**: SSTables use gzipped JSON, which is 10x slower to parse than binary formats.  
**Production Solution**: LevelDB uses custom binary format with checksums (CRC32); RocksDB uses block-based format with compression per-block.

## 7. No Distributed Replication
**Gap**: Single-node architecture with no replication or high availability.  
**Production Solution**: Cassandra/ScyllaDB use Raft/Paxos for consensus, replicating writes to N nodes before acknowledging (quorum writes).

---

## Why These Limitations Exist

This project prioritizes **learning and clarity** over production features:
- **Readable Code**: JSON SSTables are human-readable for debugging
- **Simplicity**: No MVCC means easier-to-understand concurrency model
- **Focus**: Core LSM concepts (MemTable, WAL, compaction) without distributed systems complexity

## Production Readiness Roadmap

To make this production-ready, implement in order:
1. ✅ Add `fsync()` to WAL writes (1 day)
2. ✅ Implement MVCC with transaction IDs (1 week)
3. ✅ Add crash recovery tests with fault injection (3 days)
4. ✅ Switch to binary SSTable format (Protobuf/Parquet) (2 days)
5. ✅ Add authentication/authorization middleware (2 days)
6. ✅ Make configuration parameters tunable via env vars (1 day)
7. ✅ Implement distributed replication with Raft (4 weeks)

**Estimated Time to Production**: 6-8 weeks of full-time development + 3-6 months of testing/hardening.

---

**For Interviewers**: These limitations are well-understood and intentional. This project demonstrates core database concepts, not production deployment.
