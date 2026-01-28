/**
 * WAL Corruption Recovery Module
 * Detects and recovers from corrupted WAL entries
 * Includes test mode for simulating corruption scenarios
 */

import fs from 'fs/promises';
import path from 'path';
import { computeCRC32, verifyCRC32 } from './crc32';
import pino from 'pino';

const logger = pino({ name: 'wal-recovery' });

export interface WALRecoveryConfig {
  walDir: string;
  testMode?: boolean; // Enable corruption simulation
  strictMode?: boolean; // Fail on any corruption vs attempt recovery
  checksumVerification?: boolean; // Enable CRC32 verification
}

export interface CorruptionReport {
  fileId: string;
  entryIndex: number;
  type: 'checksum_mismatch' | 'truncated' | 'invalid_json' | 'unknown';
  recovered: boolean;
  details: string;
}

export class WALRecovery {
  private config: WALRecoveryConfig;
  private corruptionReports: CorruptionReport[] = [];
  private lastValidSequence: number = 0;

  constructor(config: WALRecoveryConfig) {
    this.config = {
      strictMode: false,
      checksumVerification: true,
      ...config,
    };
  }

  /**
   * Detect corruption in WAL files
   */
  async detectCorruption(walFilePath: string): Promise<CorruptionReport[]> {
    const reports: CorruptionReport[] = [];

    try {
      const fileContent = await fs.readFile(walFilePath, 'utf8');
      const lines = fileContent.split('\n').filter((line) => line.trim());
      const fileId = path.basename(walFilePath);

      for (let i = 0; i < lines.length; i++) {
        try {
          const entry = JSON.parse(lines[i]);

          // Verify structure
          if (!entry.sequence || !entry.operation || !entry.key) {
            reports.push({
              fileId,
              entryIndex: i,
              type: 'invalid_json',
              recovered: false,
              details: 'Missing required fields: sequence, operation, or key',
            });
            continue;
          }

          // Verify sequence continuity
          if (entry.sequence !== this.lastValidSequence + 1) {
            reports.push({
              fileId,
              entryIndex: i,
              type: 'truncated',
              recovered: false,
              details: `Sequence gap: expected ${this.lastValidSequence + 1}, got ${entry.sequence}`,
            });
          }

          // Verify checksum if available
          if (this.config.checksumVerification && entry.checksum) {
            const entryData = Buffer.from(
              JSON.stringify({
                sequence: entry.sequence,
                timestamp: entry.timestamp,
                operation: entry.operation,
                key: entry.key,
                value: entry.value,
              })
            );

            const computedChecksum = computeCRC32(entryData);
            if (computedChecksum !== entry.checksum) {
              reports.push({
                fileId,
                entryIndex: i,
                type: 'checksum_mismatch',
                recovered: false,
                details: `Checksum mismatch: expected ${entry.checksum}, computed ${computedChecksum}`,
              });
            }
          }

          this.lastValidSequence = Math.max(this.lastValidSequence, entry.sequence);
        } catch (err) {
          if (err instanceof SyntaxError) {
            reports.push({
              fileId,
              entryIndex: i,
              type: 'invalid_json',
              recovered: false,
              details: `Failed to parse JSON: ${err.message}`,
            });
          } else {
            reports.push({
              fileId,
              entryIndex: i,
              type: 'unknown',
              recovered: false,
              details: `Unknown error: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error reading WAL file');
      throw err;
    }

    return reports;
  }

  /**
   * Recover from corruption by truncating at last valid entry
   */
  async recoverFromCorruption(walFilePath: string): Promise<{ recovered: boolean; entriesKept: number; entriesDropped: number }> {
    const fileContent = await fs.readFile(walFilePath, 'utf8');
    const lines = fileContent.split('\n').filter((line) => line.trim());
    let lastValidIndex = -1;
    const fileId = path.basename(walFilePath);

    for (let i = 0; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);

        // Basic validation
        if (entry.sequence && entry.operation && entry.key) {
          lastValidIndex = i;
        }
      } catch {
        // Invalid entry, stop here
        break;
      }
    }

    if (lastValidIndex === -1) {
      logger.warn({ fileId }, 'No valid entries found in WAL file');
      return { recovered: false, entriesKept: 0, entriesDropped: lines.length };
    }

    if (lastValidIndex < lines.length - 1) {
      // Truncate file at last valid entry
      const recoveredContent = lines.slice(0, lastValidIndex + 1).join('\n') + '\n';
      await fs.writeFile(walFilePath, recoveredContent, 'utf8');

      const entriesDropped = lines.length - lastValidIndex - 1;
      logger.info({ fileId, entriesKept: lastValidIndex + 1, entriesDropped }, 'WAL recovery completed');

      return {
        recovered: true,
        entriesKept: lastValidIndex + 1,
        entriesDropped,
      };
    }

    return { recovered: false, entriesKept: lines.length, entriesDropped: 0 };
  }

  /**
   * Simulate WAL corruption for testing
   */
  async simulateCorruption(walFilePath: string, type: 'truncate' | 'corrupt_checksum' | 'corrupt_json'): Promise<void> {
    if (!this.config.testMode) {
      logger.warn('Test mode disabled - cannot simulate corruption');
      return;
    }

    const fileContent = await fs.readFile(walFilePath, 'utf8');
    const lines = fileContent.split('\n').filter((line) => line.trim());

    if (lines.length === 0) {
      logger.warn('WAL file is empty - cannot simulate corruption');
      return;
    }

    let corruptedContent: string;

    switch (type) {
      case 'truncate': {
        // Truncate mid-entry in last line
        const lastLine = lines[lines.length - 1];
        const truncatedLine = lastLine.substring(0, Math.floor(lastLine.length / 2));
        corruptedContent = [...lines.slice(0, -1), truncatedLine].join('\n') + '\n';
        logger.info('Simulated WAL truncation corruption');
        break;
      }

      case 'corrupt_checksum': {
        // Modify checksum in last entry
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        if (lastEntry.checksum) {
          lastEntry.checksum = (lastEntry.checksum + 1) ^ 0xffffffff;
        }
        corruptedContent = [...lines.slice(0, -1), JSON.stringify(lastEntry)].join('\n') + '\n';
        logger.info('Simulated WAL checksum corruption');
        break;
      }

      case 'corrupt_json': {
        // Break JSON in last entry
        const lastLine = lines[lines.length - 1];
        const corruptedLine = lastLine.substring(0, lastLine.length - 2) + '}}'; // Invalid JSON
        corruptedContent = [...lines.slice(0, -1), corruptedLine].join('\n') + '\n';
        logger.info('Simulated WAL JSON corruption');
        break;
      }
    }

    await fs.writeFile(walFilePath, corruptedContent, 'utf8');
  }

  /**
   * Get corruption reports
   */
  getReports(): CorruptionReport[] {
    return this.corruptionReports;
  }

  /**
   * Clear reports
   */
  clearReports(): void {
    this.corruptionReports = [];
    this.lastValidSequence = 0;
  }
}

/**
 * Verify WAL entry integrity with CRC32
 */
export function createWALEntry(
  sequence: number,
  operation: 'PUT' | 'DELETE',
  key: string,
  value?: Buffer,
  isBatch?: boolean
): {
  sequence: number;
  timestamp: number;
  operation: string;
  key: string;
  value?: string;
  is_batch?: boolean;
  checksum: number;
} {
  const entry = {
    sequence,
    timestamp: Date.now(),
    operation,
    key,
    ...(value && { value: value.toString('base64') }),
    ...(isBatch && { is_batch: true }),
  };

  // Compute checksum
  const entryData = Buffer.from(JSON.stringify(entry));
  const checksum = computeCRC32(entryData);

  return { ...entry, checksum };
}
