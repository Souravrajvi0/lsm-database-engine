/**
 * Skip List Implementation
 * 
 * A probabilistic data structure that maintains sorted order with O(log n) operations.
 * Used instead of a hash map for the MemTable to eliminate O(n log n) sorting during flush.
 * 
 * Time Complexity:
 * - Insert: O(log n) average, O(n) worst case
 * - Search: O(log n) average, O(n) worst case
 * - Delete: O(log n) average, O(n) worst case
 * - Iterate (sorted): O(n)
 * 
 * Space Complexity: O(n) with ~2n pointers on average
 * 
 * Advantages over Map:
 * - Keys are always sorted (no flush-time sorting needed)
 * - Efficient range queries
 * - Memory efficient (no separate array needed)
 */

interface SkipListNode<K, V> {
  key: K | null;
  value: V | null;
  forward: SkipListNode<K, V>[];
}

export class SkipList<K, V> {
  private head: SkipListNode<K, V>;
  private maxLevel: number;
  private level: number;
  private size: number;
  private compareFn: (a: K, b: K) => number;
  private probability: number;

  /**
   * Create a new Skip List
   * @param compareFn - Comparison function for keys (return <0, 0, or >0)
   * @param maxLevel - Maximum height of the skip list (default: 16)
   * @param probability - Probability of increasing level (default: 0.5)
   */
  constructor(
    compareFn: (a: K, b: K) => number = (a, b) => (a < b ? -1 : a > b ? 1 : 0),
    maxLevel: number = 16,
    probability: number = 0.5
  ) {
    this.maxLevel = maxLevel;
    this.level = 0;
    this.size = 0;
    this.compareFn = compareFn;
    this.probability = probability;

    // Create head node with null key/value
    this.head = {
      key: null,
      value: null,
      forward: new Array(maxLevel).fill(null),
    };
  }

  /**
   * Generate a random level for a new node
   */
  private randomLevel(): number {
    let level = 0;
    while (Math.random() < this.probability && level < this.maxLevel - 1) {
      level++;
    }
    return level;
  }

  /**
   * Insert or update a key-value pair
   * If key exists, updates the value. Otherwise, inserts new node.
   */
  insert(key: K, value: V): void {
    const update: SkipListNode<K, V>[] = new Array(this.maxLevel).fill(null);
    let current = this.head;

    // Find insertion point
    for (let i = this.level; i >= 0; i--) {
      while (
        current.forward[i] &&
        current.forward[i].key !== null &&
        this.compareFn(current.forward[i].key!, key) < 0
      ) {
        current = current.forward[i];
      }
      update[i] = current;
    }

    current = current.forward[0];

    // Update if key exists
    if (current && current.key !== null && this.compareFn(current.key, key) === 0) {
      current.value = value;
      return;
    }

    // Insert new node
    const newLevel = this.randomLevel();
    if (newLevel > this.level) {
      for (let i = this.level + 1; i <= newLevel; i++) {
        update[i] = this.head;
      }
      this.level = newLevel;
    }

    const newNode: SkipListNode<K, V> = {
      key,
      value,
      forward: new Array(newLevel + 1).fill(null),
    };

    for (let i = 0; i <= newLevel; i++) {
      newNode.forward[i] = update[i].forward[i];
      update[i].forward[i] = newNode;
    }

    this.size++;
  }

  /**
   * Search for a value by key
   * @returns The value if found, undefined otherwise
   */
  get(key: K): V | undefined {
    let current = this.head;

    for (let i = this.level; i >= 0; i--) {
      while (
        current.forward[i] &&
        current.forward[i].key !== null &&
        this.compareFn(current.forward[i].key!, key) < 0
      ) {
        current = current.forward[i];
      }
    }

    current = current.forward[0];

    if (current && current.key !== null && this.compareFn(current.key, key) === 0) {
      return current.value!;
    }

    return undefined;
  }

  /**
   * Check if a key exists
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key-value pair
   * @returns true if deleted, false if key not found
   */
  delete(key: K): boolean {
    const update: SkipListNode<K, V>[] = new Array(this.maxLevel).fill(null);
    let current = this.head;

    for (let i = this.level; i >= 0; i--) {
      while (
        current.forward[i] &&
        current.forward[i].key !== null &&
        this.compareFn(current.forward[i].key!, key) < 0
      ) {
        current = current.forward[i];
      }
      update[i] = current;
    }

    current = current.forward[0];

    if (!current || current.key === null || this.compareFn(current.key, key) !== 0) {
      return false;
    }

    // Remove node
    for (let i = 0; i <= this.level; i++) {
      if (update[i].forward[i] !== current) {
        break;
      }
      update[i].forward[i] = current.forward[i];
    }

    // Update level
    while (this.level > 0 && this.head.forward[this.level] === null) {
      this.level--;
    }

    this.size--;
    return true;
  }

  /**
   * Get the number of entries
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.head.forward = new Array(this.maxLevel).fill(null);
    this.level = 0;
    this.size = 0;
  }

  /**
   * Iterate over all entries in sorted order
   * @param callback - Function called for each key-value pair
   */
  forEach(callback: (key: K, value: V, index: number) => void): void {
    let current = this.head.forward[0];
    let index = 0;

    while (current) {
      if (current.key !== null && current.value !== null) {
        callback(current.key, current.value, index);
      }
      current = current.forward[0];
      index++;
    }
  }

  /**
   * Get all entries as an array (already sorted)
   * Much faster than sorting a Map!
   */
  toArray(): Array<[K, V]> {
    const result: Array<[K, V]> = [];
    let current = this.head.forward[0];

    while (current) {
      if (current.key !== null && current.value !== null) {
        result.push([current.key, current.value]);
      }
      current = current.forward[0];
    }

    return result;
  }

  /**
   * Get entries in a key range
   * @param startKey - Start of range (inclusive), undefined for no lower bound
   * @param endKey - End of range (inclusive), undefined for no upper bound
   */
  range(startKey?: K, endKey?: K): Array<[K, V]> {
    const result: Array<[K, V]> = [];
    let current = this.head.forward[0];

    // Skip to start key if specified
    if (startKey !== undefined) {
      current = this.head;
      for (let i = this.level; i >= 0; i--) {
        while (
          current.forward[i] &&
          current.forward[i].key !== null &&
          this.compareFn(current.forward[i].key!, startKey) < 0
        ) {
          current = current.forward[i];
        }
      }
      current = current.forward[0];
    }

    // Collect entries in range
    while (current && current.key !== null) {
      if (endKey !== undefined && this.compareFn(current.key, endKey) > 0) {
        break;
      }
      if (current.value !== null) {
        result.push([current.key, current.value]);
      }
      current = current.forward[0];
    }

    return result;
  }

  /**
   * Get statistics about the skip list structure
   */
  getStats() {
    return {
      size: this.size,
      level: this.level,
      maxLevel: this.maxLevel,
      probability: this.probability,
      averagePathLength: this.calculateAveragePathLength(),
    };
  }

  /**
   * Calculate average search path length (for performance analysis)
   */
  private calculateAveragePathLength(): number {
    if (this.size === 0) return 0;

    let totalPath = 0;
    let current = this.head.forward[0];

    while (current) {
      let pathLength = 0;
      let search = this.head;

      // Simulate search for this key
      for (let i = this.level; i >= 0; i--) {
        while (
          search.forward[i] &&
          search.forward[i] !== current &&
          search.forward[i].key !== null &&
          this.compareFn(search.forward[i].key!, current.key!) < 0
        ) {
          search = search.forward[i];
          pathLength++;
        }
        pathLength++;
      }

      totalPath += pathLength;
      current = current.forward[0];
    }

    return totalPath / this.size;
  }
}
