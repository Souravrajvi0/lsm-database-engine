import fs from 'fs';
import path from 'path';
import { LSMTree } from './lsm';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: number;
  checks: {
    [key: string]: {
      status: 'ok' | 'warn' | 'error';
      message?: string;
      details?: any;
    };
  };
}

export class HealthCheckManager {
  private dataDir = path.join(process.cwd(), 'data');
  private walPath = path.join(this.dataDir, 'wal.log');
  private sstDir = path.join(this.dataDir, 'sstables');
  
  constructor(private lsm: LSMTree) {}

  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};

    // Check 1: Memtable Health
    checks.memtable = this.checkMemtable();

    // Check 2: WAL Health
    checks.wal = this.checkWAL();

    // Check 3: SSTable Health
    checks.sstables = this.checkSSTables();

    // Check 4: Disk Space
    checks.disk = await this.checkDiskSpace();

    // Check 5: Data Directory
    checks.data_directory = this.checkDataDirectory();

    // Determine overall status
    const statuses = Object.values(checks).map(c => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.includes('error')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('warn')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      uptime: process.uptime(),
      timestamp: Date.now(),
      checks
    };
  }

  private checkMemtable() {
    try {
      const stats = this.lsm.getStats();
      const memtableSize = stats.memtableSize || 0;
      const entryCount = stats.memtableEntries || 0;
      const threshold = 50 * 1024; // 50KB threshold

      if (memtableSize > threshold * 1.5) {
        return {
          status: 'warn' as const,
          message: 'Memtable approaching flush threshold',
          details: { size: memtableSize, entryCount, threshold }
        };
      }

      return {
        status: 'ok' as const,
        details: { size: memtableSize, entryCount }
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message: `Memtable check failed: ${error}`
      };
    }
  }

  private checkWAL() {
    try {
      if (!fs.existsSync(this.walPath)) {
        return {
          status: 'warn' as const,
          message: 'WAL file not found (new database)'
        };
      }

      const stats = fs.statSync(this.walPath);
      const sizeGB = stats.size / (1024 * 1024 * 1024);

      if (sizeGB > 1) {
        return {
          status: 'warn' as const,
          message: 'WAL file is large, consider rotation',
          details: { sizeGB, sizeBytes: stats.size }
        };
      }

      return {
        status: 'ok' as const,
        details: { sizeBytes: stats.size }
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message: `WAL check failed: ${error}`
      };
    }
  }

  private checkSSTables() {
    try {
      if (!fs.existsSync(this.sstDir)) {
        return {
          status: 'ok' as const,
          message: 'No SSTables yet',
          details: { count: 0 }
        };
      }

      const files = fs.readdirSync(this.sstDir).filter(f => f.endsWith('.json'));
      const count = files.length;

      if (count > 100) {
        return {
          status: 'warn' as const,
          message: 'Large number of SSTables, compaction may be needed',
          details: { count }
        };
      }

      return {
        status: 'ok' as const,
        details: { count }
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message: `SSTable check failed: ${error}`
      };
    }
  }

  private async checkDiskSpace(): Promise<any> {
    try {
      const stats = this.lsm.getStats();
      const diskUsageBytes = stats.diskUsage || 0;
      const diskUsageGB = diskUsageBytes / (1024 * 1024 * 1024);
      const warningThreshold = 10; // 10GB warning

      if (diskUsageGB > warningThreshold) {
        return {
          status: 'warn' as const,
          message: 'High disk usage',
          details: { diskUsageGB, diskUsageBytes }
        };
      }

      return {
        status: 'ok' as const,
        details: { diskUsageGB, diskUsageBytes }
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message: `Disk space check failed: ${error}`
      };
    }
  }

  private checkDataDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        return {
          status: 'error' as const,
          message: 'Data directory does not exist'
        };
      }

      const stats = fs.statSync(this.dataDir);
      if (!stats.isDirectory()) {
        return {
          status: 'error' as const,
          message: 'Data path is not a directory'
        };
      }

      return {
        status: 'ok' as const,
        message: 'Data directory is accessible'
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message: `Data directory check failed: ${error}`
      };
    }
  }
}
