/**
 * Compression Utilities
 * 
 * Provides compression/decompression for SSTables to reduce disk space.
 * Uses gzip compression which typically achieves 60-70% space savings
 * for text data.
 * 
 * Trade-off: Increased CPU usage for better disk I/O and storage efficiency.
 */

import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class CompressionUtil {
  /**
   * Compress data using gzip
   * @param data - Data to compress (string or Buffer)
   * @returns Compressed buffer
   */
  static async compress(data: string | Buffer): Promise<Buffer> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    return await gzip(buffer);
  }

  /**
   * Decompress gzipped data
   * @param compressedData - Compressed buffer
   * @returns Decompressed buffer
   */
  static async decompress(compressedData: Buffer): Promise<Buffer> {
    return await gunzip(compressedData);
  }

  /**
   * Compress and get compression statistics
   * @param data - Data to compress
   * @returns Object with compressed data and stats
   */
  static async compressWithStats(
    data: string | Buffer
  ): Promise<{
    compressed: Buffer;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    savingsPercent: number;
  }> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const originalSize = buffer.length;

    const compressed = await gzip(buffer);
    const compressedSize = compressed.length;

    const compressionRatio = compressedSize / originalSize;
    const savingsPercent = ((1 - compressionRatio) * 100);

    return {
      compressed,
      originalSize,
      compressedSize,
      compressionRatio,
      savingsPercent,
    };
  }

  /**
   * Decompress and return as string
   * @param compressedData - Compressed buffer
   * @returns Decompressed string
   */
  static async decompressToString(compressedData: Buffer): Promise<string> {
    const decompressed = await gunzip(compressedData);
    return decompressed.toString('utf-8');
  }
}
