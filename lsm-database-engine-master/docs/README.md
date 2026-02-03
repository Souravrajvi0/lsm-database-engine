# LSM Tree Storage Engine - Interview Documentation

## Overview

This directory contains comprehensive interview preparation documentation for the LSM Tree Storage Engine project. All documents are designed to help you confidently discuss this project in technical interviews for Backend/Full-Stack Developer positions (1-2 years experience, 7-10 LPA salary range).

---

## 📚 Document Guide

### Core Documentation

| Document | Purpose | When to Use | Prep Time |
|----------|---------|-------------|-----------|
| **[backend-architecture-diagrams.md](./backend-architecture-diagrams.md)** | 7 detailed Mermaid diagrams visualizing system architecture | "Walk me through your architecture" questions | 10-30 min |
| **[backend-interview-qa.md](./backend-interview-qa.md)** | 50+ technical Q&A with code examples and metrics | General technical interview preparation | 2-4 hours |
| **[interview-cheat-sheet.md](./interview-cheat-sheet.md)** | Quick reference guide with key numbers and talking points | Last-minute review before interview | 15-30 min |
| **[tech-decisions-justification.md](./tech-decisions-justification.md)** | Detailed explanation of technical decisions with benchmarks | "Why did you choose X?" questions | 1-2 hours |
| **[star-stories.md](./star-stories.md)** | 15+ STAR method behavioral stories | Behavioral interview questions | 2-3 hours |

### Supplementary Documentation

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[performance-benchmarks.md](./performance-benchmarks.md)** | Detailed performance analysis and comparisons | Performance-focused discussions |
| **[common-interview-scenarios.md](./common-interview-scenarios.md)** | Practical responses to common scenarios | Mock interview practice |

---

## 🎯 Interview Preparation Roadmap

### 1 Week Before Interview

**Day 1-2: Core Concepts**
- [ ] Read [backend-architecture-diagrams.md](./backend-architecture-diagrams.md) completely
- [ ] Understand all 7 diagrams and when to use each
- [ ] Memorize key metrics from [interview-cheat-sheet.md](./interview-cheat-sheet.md)

**Day 3-4: Technical Deep Dive**
- [ ] Study [backend-interview-qa.md](./backend-interview-qa.md) - focus on sections I-III
- [ ] Practice explaining code examples out loud
- [ ] Review [tech-decisions-justification.md](./tech-decisions-justification.md)

**Day 5-6: Behavioral Prep**
- [ ] Read all stories in [star-stories.md](./star-stories.md)
- [ ] Memorize 5-7 core stories
- [ ] Practice telling stories out loud (2-3 min each)

**Day 7: Final Review**
- [ ] Re-read [interview-cheat-sheet.md](./interview-cheat-sheet.md)
- [ ] Do a mock interview with a friend
- [ ] Review troubleshooting guide in architecture diagrams

---

### 2 Weeks Before Interview

**Week 1: Foundation**
- [ ] Read all documents once
- [ ] Create flashcards for key metrics
- [ ] Practice drawing diagrams on whiteboard

**Week 2: Practice**
- [ ] Answer all Q&A questions out loud
- [ ] Record yourself explaining the project
- [ ] Do 2-3 mock interviews

---

### 1 Month Before Interview

**Week 1-2: Learning**
- [ ] Deep dive into each document
- [ ] Understand the "why" behind every decision
- [ ] Research industry comparisons (RocksDB, LevelDB, Cassandra)

**Week 3: Practice**
- [ ] Practice explaining to non-technical friends
- [ ] Write blog post about the project
- [ ] Create presentation slides

**Week 4: Polish**
- [ ] Mock interviews
- [ ] Refine talking points
- [ ] Final review of cheat sheet

---

## 🚀 Quick Start Guide (Last-Minute Prep)

If you have **< 1 hour** before the interview:

1. **Read** [interview-cheat-sheet.md](./interview-cheat-sheet.md) (15 min)
2. **Review** 30-second elevator pitch (5 min)
3. **Memorize** key numbers: 3.5k ops/sec, 97% coverage, 47% compression, 90% bloom efficiency (5 min)
4. **Practice** "Walk me through your project" response (10 min)
5. **Review** Diagram 1 (High-Level Architecture) (10 min)
6. **Scan** STAR stories 1, 5, 8 (15 min)

---

## 📊 Key Metrics to Memorize

### Performance
- **Write Throughput**: ~3,500 ops/sec
- **Write Latency (p50)**: 0.8ms (no flush), 45ms (with flush)
- **Read Latency (p50)**: 0.1ms (MemTable), 2-5ms (SSTable)
- **Bloom Filter Efficiency**: 90% disk reads saved
- **Compression**: 47% (Protobuf vs JSON), 81% (Protobuf+Gzip)

### Code Quality
- **Test Coverage**: 97%
- **Code Size**: ~1,900 lines (core engine)
- **Docker Image**: 65MB (Alpine Linux)

### Architecture
- **MemTable Threshold**: 50 entries / 50MB
- **L0 Compaction Trigger**: 4 files
- **Compaction Time**: 150-300ms
- **Write Amplification**: 7-10x

---

## 🎤 Interview Format Strategies

### Phone Screen (30 min)
1. **Elevator Pitch** (2 min)
2. **High-Level Architecture** (5 min) - Use Diagram 1
3. **One Deep Dive** (15 min) - Pick bloom filters OR compaction
4. **Questions** (5 min)
5. **Closing** (3 min)

### Technical Interview (45-60 min)
1. **Elevator Pitch** (3 min)
2. **Architecture Overview** (8 min) - Diagrams 1 & 2
3. **Write Path** (10 min) - Trace PUT request with code
4. **Read Path** (10 min) - Explain optimizations
5. **Compaction** (12 min) - Algorithm walkthrough
6. **Questions** (10 min)
7. **Closing** (2 min)

### Behavioral Interview (45 min)
1. **Project Overview** (5 min)
2. **STAR Story 1** (Technical Challenge) (8 min)
3. **STAR Story 2** (Performance Improvement) (8 min)
4. **STAR Story 3** (Learning Experience) (8 min)
5. **STAR Story 4** (Collaboration) (8 min)
6. **Questions** (5 min)
7. **Closing** (3 min)

---

## 💡 Tips for Success

### DO:
- ✅ Use specific metrics (90% bloom efficiency, 47% compression)
- ✅ Reference actual code files (`server/lsm.ts`, `server/bloom-filter.ts`)
- ✅ Compare to industry standards (RocksDB, LevelDB, Cassandra)
- ✅ Admit trade-offs honestly (write speed vs read speed)
- ✅ Show enthusiasm and passion for the project

### DON'T:
- ❌ Say "It's faster than Redis" (different use cases)
- ❌ Claim it's production-ready at scale (be honest about limitations)
- ❌ Oversell or exaggerate capabilities
- ❌ Memorize answers word-for-word (sound natural)
- ❌ Skip the "why" behind decisions

---

## 🔗 Cross-References

### Common Question Mappings

| Question | Primary Doc | Secondary Doc |
|----------|-------------|---------------|
| "Walk me through your project" | [Cheat Sheet](./interview-cheat-sheet.md) | [Diagrams](./backend-architecture-diagrams.md) |
| "Why LSM tree?" | [Tech Decisions](./tech-decisions-justification.md) | [Q&A #2](./backend-interview-qa.md) |
| "How do writes work?" | [Diagrams #2](./backend-architecture-diagrams.md) | [Q&A #5](./backend-interview-qa.md) |
| "Explain bloom filters" | [Q&A #41](./backend-interview-qa.md) | [STAR Story #1](./star-stories.md) |
| "Biggest challenge?" | [STAR Story #1](./star-stories.md) | [Tech Decisions](./tech-decisions-justification.md) |
| "What would you do differently?" | [Tech Decisions #8](./tech-decisions-justification.md) | [Q&A #9](./backend-interview-qa.md) |

---

## 📈 Continuous Improvement

### After Each Interview
- [ ] Note which questions were asked
- [ ] Identify areas where you struggled
- [ ] Update documents with new insights
- [ ] Practice weak areas

### Feedback Loop
- [ ] Ask interviewers for feedback
- [ ] Review recordings of mock interviews
- [ ] Refine talking points based on what works
- [ ] Update cheat sheet with new metrics

---

## 🎓 Additional Resources

### Related Documentation
- **Main README**: `../README.md` - Project overview and setup
- **API Documentation**: `../API.md` - REST API reference
- **Contributing Guide**: `../CONTRIBUTING.md` - Development guidelines

### External Resources
- [Original LSM Tree Paper](https://www.cs.umb.edu/~poneil/lsmtree.pdf) - O'Neil et al., 1996
- [LevelDB Source Code](https://github.com/google/leveldb) - Google's implementation
- [RocksDB Wiki](https://github.com/facebook/rocksdb/wiki) - Facebook's fork of LevelDB

---

## 📝 Document Versions

| Document | Version | Last Updated | Lines |
|----------|---------|--------------|-------|
| backend-architecture-diagrams.md | 2.0 | 2026-02-03 | 1,450+ |
| backend-interview-qa.md | 2.0 | 2026-02-03 | 500+ |
| interview-cheat-sheet.md | 2.0 | 2026-02-03 | 400+ |
| tech-decisions-justification.md | 2.0 | 2026-02-03 | 350+ |
| star-stories.md | 2.0 | 2026-02-03 | 450+ |

**Total Documentation**: ~3,000+ lines of interview preparation material

---

## 🤝 Contributing

Found a typo or have suggestions for improvement?
1. Open an issue in the main repository
2. Submit a pull request with improvements
3. Share your interview experience to help others

---

## 📞 Contact

For questions or feedback about this documentation:
- Open an issue in the repository
- Reach out to the project maintainer

---

**Good luck with your interviews! 🚀**

Remember: You built this from scratch. You understand the internals. You made deliberate technical decisions. Be confident!
