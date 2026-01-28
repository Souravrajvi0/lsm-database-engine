/**
 * CRC32 Checksum module for SSTable integrity verification
 * Ensures data corruption is detected during read operations
 */

// Precomputed CRC32 lookup table
const CRC32_TABLE: number[] = [];
const CRC32_POLYNOMIAL = 0xedb88320;

// Initialize lookup table
function initializeCRC32Table(): void {
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ CRC32_POLYNOMIAL : crc >>> 1;
    }
    CRC32_TABLE[i] = crc >>> 0;
  }
}

/**
 * Compute CRC32 checksum for a buffer
 */
export function computeCRC32(data: Buffer): number {
  if (CRC32_TABLE.length === 0) {
    initializeCRC32Table();
  }

  let crc = 0 ^ -1;

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

/**
 * Verify CRC32 checksum
 */
export function verifyCRC32(data: Buffer, expectedChecksum: number): boolean {
  const computedChecksum = computeCRC32(data);
  return computedChecksum === expectedChecksum;
}

/**
 * Compute checksum from SSTable entries
 */
export function computeSSTableChecksum(entries: any[], level: number): number {
  const data = Buffer.concat([
    Buffer.from(JSON.stringify(entries)),
    Buffer.from(`level:${level}`, 'utf8'),
  ]);
  return computeCRC32(data);
}

/**
 * Verify SSTable data integrity
 */
export function verifySSTableIntegrity(entries: any[], level: number, storedChecksum: number): boolean {
  const computedChecksum = computeSSTableChecksum(entries, level);
  return computedChecksum === storedChecksum;
}

// Initialize table on module load
initializeCRC32Table();
