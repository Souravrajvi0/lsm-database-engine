/**
 * Bloom Filter Unit Tests
 * 
 * Tests the bloom filter implementation for correctness, false positive rates,
 * serialization, and edge cases.
 */

import { BloomFilter } from '../server/bloom-filter';

describe('BloomFilter', () => {
  describe('Basic Operations', () => {
    test('should add and check for presence of keys', () => {
      const bloom = new BloomFilter(100, 0.01);
      
      bloom.add('key1');
      bloom.add('key2');
      bloom.add('key3');
      
      expect(bloom.mightContain('key1')).toBe(true);
      expect(bloom.mightContain('key2')).toBe(true);
      expect(bloom.mightContain('key3')).toBe(true);
    });

    test('should return false for keys definitely not present', () => {
      const bloom = new BloomFilter(100, 0.01);
      
      bloom.add('key1');
      
      // These keys were never added, so bloom filter should return false
      // (unless we hit a false positive, but with 100 expected elements
      // and 1% FP rate, it's unlikely)
      expect(bloom.mightContain('key_not_added')).toBe(false);
    });

    test('should handle empty bloom filter', () => {
      const bloom = new BloomFilter(100, 0.01);
      
      // Empty filter should return false for any key
      expect(bloom.mightContain('anything')).toBe(false);
    });
  });

  describe('False Positive Rate', () => {
    test('should maintain acceptable false positive rate', () => {
      const bloom = new BloomFilter(1000, 0.01); // 1% FP rate
      
      // Add 1000 keys
      for (let i = 0; i < 1000; i++) {
        bloom.add(`key_${i}`);
      }
      
      // Test with 10000 keys not in the filter
      let falsePositives = 0;
      for (let i = 1000; i < 11000; i++) {
        if (bloom.mightContain(`key_${i}`)) {
          falsePositives++;
        }
      }
      
      const fpRate = falsePositives / 10000;
      
      // FP rate should be close to 1% (allow up to 3% due to randomness)
      expect(fpRate).toBeLessThan(0.03);
    });

    test('should report false positive rate statistics', () => {
      const bloom = new BloomFilter(100, 0.01);
      
      for (let i = 0; i < 50; i++) {
        bloom.add(`key_${i}`);
      }
      
      const stats = bloom.getStats();
      
      expect(stats).toHaveProperty('sizeInBits');
      expect(stats).toHaveProperty('numHashes');
      expect(stats).toHaveProperty('setBits');
      expect(stats).toHaveProperty('fillRatio');
      expect(stats).toHaveProperty('estimatedFPR');
    });
  });

  describe('Serialization', () => {
    test('should serialize and deserialize correctly', () => {
      const bloom1 = new BloomFilter(100, 0.01);
      
      bloom1.add('apple');
      bloom1.add('banana');
      bloom1.add('cherry');
      
      const serialized = bloom1.serialize();
      const bloom2 = BloomFilter.deserialize(serialized);
      
      expect(bloom2.mightContain('apple')).toBe(true);
      expect(bloom2.mightContain('banana')).toBe(true);
      expect(bloom2.mightContain('cherry')).toBe(true);
      expect(bloom2.mightContain('not_added')).toBe(false);
    });

    test('should preserve bloom filter properties after deserialization', () => {
      const bloom1 = new BloomFilter(500, 0.02);
      
      for (let i = 0; i < 100; i++) {
        bloom1.add(`item_${i}`);
      }
      
      const stats1 = bloom1.getStats();
      const serialized = bloom1.serialize();
      const bloom2 = BloomFilter.deserialize(serialized);
      const stats2 = bloom2.getStats();
      
      expect(stats2.sizeInBits).toBe(stats1.sizeInBits);
      expect(stats2.numHashes).toBe(stats1.numHashes);
      expect(stats2.setBits).toBe(stats1.setBits);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very small bloom filters', () => {
      const bloom = new BloomFilter(10, 0.1);
      
      bloom.add('a');
      bloom.add('b');
      
      expect(bloom.mightContain('a')).toBe(true);
      expect(bloom.mightContain('b')).toBe(true);
    });

    test('should handle special characters in keys', () => {
      const bloom = new BloomFilter(100, 0.01);
      
      const specialKeys = [
        'key with spaces',
        'key-with-dashes',
        'key_with_underscores',
        'key.with.dots',
        'key@with@symbols',
        '日本語キー',
        'emoji_🔑_key'
      ];
      
      specialKeys.forEach(key => bloom.add(key));
      
      specialKeys.forEach(key => {
        expect(bloom.mightContain(key)).toBe(true);
      });
    });

    test('should handle empty strings', () => {
      const bloom = new BloomFilter(100, 0.01);
      
      bloom.add('');
      
      expect(bloom.mightContain('')).toBe(true);
      expect(bloom.mightContain('not_empty')).toBe(false);
    });

    test('should handle very long keys', () => {
      const bloom = new BloomFilter(100, 0.01);
      
      const longKey = 'x'.repeat(10000);
      bloom.add(longKey);
      
      expect(bloom.mightContain(longKey)).toBe(true);
      expect(bloom.mightContain('x'.repeat(9999))).toBe(false);
    });
  });

  describe('Performance Characteristics', () => {
    test('should handle large number of insertions efficiently', () => {
      const bloom = new BloomFilter(10000, 0.01);
      const startTime = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        bloom.add(`key_${i}`);
      }
      
      const insertTime = performance.now() - startTime;
      
      // Should complete in reasonable time (< 1 second for 10k insertions)
      expect(insertTime).toBeLessThan(1000);
    });

    test('should perform lookups efficiently', () => {
      const bloom = new BloomFilter(10000, 0.01);
      
      for (let i = 0; i < 10000; i++) {
        bloom.add(`key_${i}`);
      }
      
      const startTime = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        bloom.mightContain(`key_${i}`);
      }
      
      const lookupTime = performance.now() - startTime;
      
      // Should complete in reasonable time (< 1 second for 10k lookups)
      expect(lookupTime).toBeLessThan(1000);
    });
  });
});
