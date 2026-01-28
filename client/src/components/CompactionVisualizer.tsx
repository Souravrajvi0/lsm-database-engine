import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface CompactionLevel {
  level: number;
  fileCount: number;
  totalSize: number;
  isCompacting: boolean;
}

interface CompactionState {
  isRunning: boolean;
  currentLevel: number;
  progress: number;
  levels: CompactionLevel[];
  completedCompactions: number;
  totalCompactions: number;
}

export function CompactionVisualizer() {
  const [compactionState, setCompactionState] = useState<CompactionState>({
    isRunning: false,
    currentLevel: 0,
    progress: 0,
    levels: [],
    completedCompactions: 0,
    totalCompactions: 0,
  });

  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchCompactionStatus = async () => {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        if (data.isCompacting !== undefined) {
          setCompactionState((prev) => ({
            ...prev,
            isRunning: data.isCompacting,
            levels: data.levels || prev.levels,
            totalCompactions: data.metrics?.totalCompactions || prev.totalCompactions,
            completedCompactions: (data.metrics?.totalCompactions || 0) - (data.isCompacting ? 1 : 0),
          }));
        }
      } catch (err) {
        console.error('Failed to fetch compaction status:', err);
      }
    };

    // Fetch immediately
    fetchCompactionStatus();

    // Set up refresh interval
    const interval = setInterval(fetchCompactionStatus, 1000);
    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const getTotalSize = (): number => {
    return compactionState.levels.reduce((sum, level) => sum + level.totalSize, 0);
  };

  const getCompactingLevelCount = (): number => {
    return compactionState.levels.filter((l) => l.isCompacting).length;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Compaction Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Compaction Progress</CardTitle>
          <CardDescription>Real-time LSM tree compaction monitoring and statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Indicators */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Status</p>
              <p className={`font-semibold ${compactionState.isRunning ? 'text-green-600' : 'text-gray-600'}`}>
                {compactionState.isRunning ? '🔄 Running' : '⏸ Idle'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Compacting Levels</p>
              <p className="text-2xl font-bold">{getCompactingLevelCount()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Total Size</p>
              <p className="text-2xl font-bold">{formatBytes(getTotalSize())}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Compaction Count</p>
              <p className="text-2xl font-bold">{compactionState.completedCompactions}</p>
            </div>
          </div>

          {/* Overall Progress */}
          {compactionState.isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Overall Progress</span>
                <span className="font-semibold">{compactionState.progress}%</span>
              </div>
              <Progress value={compactionState.progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Level Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Level Distribution</CardTitle>
          <CardDescription>File count and storage usage per LSM level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {compactionState.levels.length === 0 ? (
              <p className="text-gray-500 text-sm">No levels yet</p>
            ) : (
              compactionState.levels.map((level) => (
                <div key={level.level} className="space-y-2">
                  {/* Level Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Level {level.level}</span>
                        {level.isCompacting && (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            🔄 Compacting
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{level.fileCount} files</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatBytes(level.totalSize)}</p>
                      <p className="text-xs text-gray-500">
                        {((level.totalSize / getTotalSize()) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                  </div>

                  {/* Level Progress Bar */}
                  <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${level.isCompacting ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}
                      style={{
                        width: `${getTotalSize() > 0 ? (level.totalSize / getTotalSize()) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compaction Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Compaction Activity</CardTitle>
          <CardDescription>Historical compaction statistics and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Compactions</p>
              <p className="text-3xl font-bold">{compactionState.totalCompactions}</p>
            </div>
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Files Per Level</p>
              <p className="text-3xl font-bold">
                {compactionState.levels.length > 0
                  ? (compactionState.levels.reduce((sum, l) => sum + l.fileCount, 0) / compactionState.levels.length).toFixed(1)
                  : '0'}
              </p>
            </div>
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Average Level Size</p>
              <p className="text-3xl font-bold">
                {compactionState.levels.length > 0
                  ? formatBytes(getTotalSize() / compactionState.levels.length)
                  : '0 B'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="text-sm text-gray-500 space-y-1">
        <p>
          💡 <span className="font-semibold">Compaction</span> merges SSTables across levels to maintain LSM structure efficiency
        </p>
        <p>
          🟢 <span className="font-semibold">Idle</span> levels are not currently being compacted
        </p>
        <p>
          🔵 <span className="font-semibold">Active</span> levels are currently undergoing compaction merge operations
        </p>
      </div>
    </div>
  );
}
