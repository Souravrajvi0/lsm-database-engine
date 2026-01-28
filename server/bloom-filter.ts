/**
 * Bloom Filter Implementation
 * 
 * A space-efficient probabilistic data structure used to test whether an element 
 * is a member of a set. False positives are possible, but false negatives are not.
 * 
 * This implementation uses multiple hash functions to achieve better accuracy.
 * The filter is used to avoid unnecessary SSTable reads during key lookups.
 * 
 * Time Complexity:
 * - Add: O(k) where k is the number of hash functions
 * - Test: O(k) where k is the number of hash functions
 * 
 * Space Complexity: O(m) where m is the size of the bit array
 */

export class BloomFilter {
  private bitArray: Uint8Array;
  private size: number; // Size in bits
  private numHashes: number;

  /**
   * Create a new Bloom Filter
   * @param expectedElements - Expected number of elements to be inserted
   * @param falsePositiveRate - Desired false positive rate (e.g., 0.01 for 1%)
   */
  constructor(expectedElements: number = 1000, falsePositiveRate: number = 0.01) {
    // Calculate optimal size (m) and number of hash functions (k)
    // m = -(n * ln(p)) / (ln(2)^2)
    // k = (m / n) * ln(2)
    this.size = Math.ceil(-(expectedElements * Math.log(falsePositiveRate)) / (Math.log(2) ** 2));
    this.numHashes = Math.ceil((this.size / expectedElements) * Math.log(2));
    
    // Ensure we have at least 1 hash function
    this.numHashes = Math.max(1, this.numHashes);
    
    // Allocate bit array (8 bits per byte)
    const numBytes = Math.ceil(this.size / 8);
    this.bitArray = new Uint8Array(numBytes);
  }

  /**
   * Add a key to the bloom filter
   */
  add(key: string): void {
    const hashes = this.getHashes(key);
    for (const hash of hashes) {
      this.setBit(hash);
    }
  }

  /**
   * Test if a key might be in the set
   * @returns true if key might be present, false if definitely not present
   */
  mightContain(key: string): boolean {
    const hashes = this.getHashes(key);
    for (const hash of hashes) {
      if (!this.getBit(hash)) {
        return false; // Definitely not present
      }
    }
    return true; // Might be present (or false positive)
  }

  /**
   * Generate k hash values for a given key using different seeds
   */
  private getHashes(key: string): number[] {
    const hashes: number[] = [];
    for (let i = 0; i < this.numHashes; i++) {
      // Use double hashing: hash_i(x) = hash1(x) + i * hash2(x)
      const hash1 = this.hash(key, 0);
      const hash2 = this.hash(key, 1);
      const combinedHash = (hash1 + i * hash2) % this.size;
      hashes.push(Math.abs(combinedHash));
    }
    return hashes;
  }

  /**
   * Simple hash function using FNV-1a algorithm
   */
  private hash(str: string, seed: number): number {
    let hash = 2166136261 ^ seed; // FNV offset basis XOR with seed
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0; // Convert to unsigned 32-bit integer
  }

  /**
   * Set a bit at the given position
   */
  private setBit(position: number): void {
    const byteIndex = Math.floor(position / 8);
    const bitIndex = position % 8;
    this.bitArray[byteIndex] |= (1 << bitIndex);
  }

  /**
   * Get the bit value at the given position
   */
  private getBit(position: number): boolean {
    const byteIndex = Math.floor(position / 8);
    const bitIndex = position % 8;
    return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
  }

  /**
   * Serialize the bloom filter to a base64 string for storage
   */
  serialize(): string {
    const metadata = JSON.stringify({
      size: this.size,
      numHashes: this.numHashes,
    });
    const base64Data = Buffer.from(this.bitArray).toString('base64');
    return JSON.stringify({ metadata, data: base64Data });
  }

  /**
   * Deserialize a bloom filter from a base64 string
   */
  static deserialize(serialized: string): BloomFilter {
    const { metadata, data } = JSON.parse(serialized);
    const { size, numHashes } = JSON.parse(metadata);
    
    const filter = new BloomFilter(1, 0.01); // Create temporary filter
    filter.size = size;
    filter.numHashes = numHashes;
    filter.bitArray = new Uint8Array(Buffer.from(data, 'base64'));
    
    return filter;
  }

  /**
   * Get the current false positive rate estimate based on fill ratio
   */
  getFalsePositiveRate(): number {
    const setBits = this.countSetBits();
    const fillRatio = setBits / this.size;
    // FPR ≈ (1 - e^(-k*n/m))^k where k=numHashes, n=elements, m=size
    return Math.pow(1 - Math.exp(-this.numHashes * fillRatio), this.numHashes);
  }

  /**
   * Count the number of set bits in the filter
   */
  private countSetBits(): number {
    let count = 0;
    for (let i = 0; i < this.bitArray.length; i++) {
      let byte = this.bitArray[i];
      while (byte > 0) {
        count += byte & 1;
        byte >>= 1;
      }
    }
    return count;
  }

  /**
   * Get statistics about the bloom filter
   */
  getStats() {
    const setBits = this.countSetBits();
    return {
      sizeInBits: this.size,
      sizeInBytes: this.bitArray.length,
      numHashes: this.numHashes,
      setBits,
      fillRatio: (setBits / this.size * 100).toFixed(2) + '%',
      estimatedFPR: (this.getFalsePositiveRate() * 100).toFixed(4) + '%',
    };
  }
}
