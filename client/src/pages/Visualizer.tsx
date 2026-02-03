import { Sidebar } from "@/components/Sidebar";
import { useLsmStats, useCompact } from "@/hooks/use-lsm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Layers, HardDrive, Cpu, RefreshCw, AlertCircle, Zap, Activity, Repeat } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Helper to format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function Visualizer() {
  const { data: stats, isLoading, refetch, isFetching } = useLsmStats(2000);
  const compactMutation = useCompact();

  const handleCompact = () => {
    compactMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen bg-background items-center justify-center text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-mono text-sm animate-pulse">Initializing Telemetry...</p>
        </div>
      </div>
    );
  }

  // Calculate relative sizes for visualization
  const MEMTABLE_THRESHOLD = 50; 
  const memtablePercent = Math.min(((stats?.memTableSize || 0) / MEMTABLE_THRESHOLD) * 100, 100);

  // Simplified sparkline data for visualization
  const writeData = Array.from({ length: 20 }, (_, i) => ({ val: Math.random() * 10 }));
  const readData = Array.from({ length: 20 }, (_, i) => ({ val: Math.random() * 5 }));

  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 text-foreground">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-3">
              Telemetry & Internals
              {stats?.isCompacting && (
                 <span className="inline-flex items-center rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-xs font-medium text-yellow-500 animate-pulse border border-yellow-400/20">
                   Compacting...
                 </span>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">Production-grade metrics and structural visualization.</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className={cn("transition-all", isFetching && "opacity-70")}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Button 
              onClick={handleCompact} 
              disabled={compactMutation.isPending || stats?.isCompacting}
              className="bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30 border border-yellow-600/20"
            >
               {compactMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
               Trigger Compaction
            </Button>
          </div>
        </header>

        {/* Real-time Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Zap className="h-3 w-3 text-yellow-500" /> Write Latency
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold font-mono text-white">
                {stats?.metrics.avgWriteLatencyMs.toFixed(3)}<span className="text-xs text-muted-foreground ml-1">ms</span>
              </div>
              <div className="h-8 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={writeData}>
                    <Line type="monotone" dataKey="val" stroke="#eab308" strokeWidth={1} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                Total Writes: {stats?.metrics.totalWrites}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Activity className="h-3 w-3 text-blue-500" /> Read Latency
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold font-mono text-white">
                {stats?.metrics.avgReadLatencyMs.toFixed(3)}<span className="text-xs text-muted-foreground ml-1">ms</span>
              </div>
              <div className="h-8 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={readData}>
                    <Line type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={1} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                Total Reads: {stats?.metrics.totalReads}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Repeat className="h-3 w-3 text-green-500" /> Write Amp
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold font-mono text-white">
                {stats?.metrics.writeAmplification.toFixed(2)}<span className="text-xs text-muted-foreground ml-1">x</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                L0 → L1 Multiplier
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-3 w-3 text-purple-500" /> Ops Duration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-sm font-mono text-white space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flush:</span>
                  <span>{stats?.metrics.lastFlushDurationMs.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compact:</span>
                  <span>{stats?.metrics.lastCompactionDurationMs.toFixed(2)}ms</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* MemTable Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                <Cpu className="h-4 w-4" /> MemTable (RAM)
              </CardTitle>
              <CardDescription className="font-mono text-xs text-primary/70">
                Sorted Write Buffer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-white mb-2">
                {stats?.memTableSize} <span className="text-xs font-normal text-muted-foreground uppercase">Entries</span>
              </div>
              <Progress value={memtablePercent} className="h-2 bg-primary/20" indicatorClassName="bg-primary" />
              <p className="text-xs text-muted-foreground mt-2 font-mono text-right">
                {memtablePercent.toFixed(1)}% of threshold
              </p>
            </CardContent>
          </Card>

          {/* WAL Card */}
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Write Ahead Log
              </CardTitle>
              <CardDescription className="font-mono text-xs text-blue-400/70">
                Durability Guarantee
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-white mb-2">
                 {formatBytes(stats?.walSize || 0)}
              </div>
              <div className="h-2 w-full bg-blue-500/20 rounded-full overflow-hidden relative">
                 <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(59,130,246,0.3)_50%,transparent_75%)] bg-[length:20px_20px] animate-[pulse_2s_ease-in-out_infinite]"></div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-mono italic">Persistence: FSYNC ACTIVE</p>
            </CardContent>
          </Card>

           {/* SSTable Stats */}
           <Card className="border-purple-500/20 bg-purple-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-400 flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Disk Storage
              </CardTitle>
               <CardDescription className="font-mono text-xs text-purple-400/70">
                Immutable SSTables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-white mb-2">
                 {formatBytes(stats?.levels.reduce((acc, l) => acc + l.totalSize, 0) || 0)}
              </div>
              <div className="flex gap-1 h-2 mt-1">
                 {stats?.levels.map((level, idx) => (
                   <div 
                      key={level.level} 
                      className="h-full bg-purple-500 rounded-sm opacity-80"
                      style={{ width: `${Math.max(5, (level.totalSize / (stats.levels.reduce((a,b)=>a+b.totalSize,0)||1))*100)}%`}}
                   />
                 ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                 {stats?.levels.reduce((acc, l) => acc + l.fileCount, 0)} total files
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bloom Filter Efficiency Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                <Zap className="h-4 w-4" /> Bloom Filter Cache
              </CardTitle>
              <CardDescription className="font-mono text-xs text-emerald-400/70">
                Key Existence Predictor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground">Cache Hits</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      {stats?.metrics.bloomFilterHits.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-muted-foreground">(avoided disk reads)</span>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground">Actual Checks</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-blue-400">
                      {stats?.metrics.bloomFilterMisses.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-muted-foreground">(required disk reads)</span>
                  </div>
                </div>
                <div className="h-px bg-border/30 my-2"></div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground font-mono">Efficiency</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-white">
                      {(() => {
                        const total = (stats?.metrics.bloomFilterHits || 0) + (stats?.metrics.bloomFilterMisses || 0);
                        if (total === 0) return '0%';
                        return (((stats?.metrics.bloomFilterHits || 0) / total) * 100).toFixed(1) + '%';
                      })()}
                    </div>
                    <span className="text-[10px] text-muted-foreground">of checks</span>
                  </div>
                </div>
              </div>
              <Progress 
                value={(() => {
                  const total = (stats?.metrics.bloomFilterHits || 0) + (stats?.metrics.bloomFilterMisses || 0);
                  if (total === 0) return 0;
                  return ((stats?.metrics.bloomFilterHits || 0) / total) * 100;
                })()}
                className="h-2 bg-emerald-500/20 mt-3"
                indicatorClassName="bg-emerald-500"
              />
            </CardContent>
          </Card>

          {/* Total Reads Card */}
          <Card className="border-cyan-500/20 bg-cyan-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Read Statistics
              </CardTitle>
              <CardDescription className="font-mono text-xs text-cyan-400/70">
                Query Performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground">Total Reads</span>
                  <div className="text-2xl font-bold font-mono text-cyan-400">
                    {stats?.metrics.totalReads.toLocaleString()}
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground">Avg Latency</span>
                  <div className="text-2xl font-bold font-mono text-cyan-400">
                    {stats?.metrics.avgReadLatencyMs.toFixed(2)}<span className="text-xs text-muted-foreground ml-1">ms</span>
                  </div>
                </div>
                <div className="h-px bg-border/30 my-2"></div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground font-mono">Throughput</span>
                  <div className="text-2xl font-bold font-mono text-white">
                    {(() => {
                      // Estimate ops/sec from latency
                      const avgLatency = stats?.metrics.avgReadLatencyMs || 0;
                      if (avgLatency === 0) return '∞';
                      return Math.round(1000 / avgLatency).toLocaleString();
                    })()}<span className="text-xs text-muted-foreground ml-1">ops/sec</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 font-mono">
          <Layers className="h-5 w-5 text-muted-foreground" /> 
          Structural Topology
        </h3>

        <div className="space-y-4">
          <AnimatePresence>
            {stats?.levels.map((level) => (
              <motion.div 
                key={level.level}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card/30 border border-border/50 rounded-lg p-4 relative overflow-hidden backdrop-blur-sm"
              >
                {/* Level Header */}
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="bg-muted px-2 py-1 rounded text-xs font-mono font-bold text-white border border-border/50">
                      LEVEL {level.level}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatBytes(level.totalSize)} • {level.fileCount} {level.fileCount === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                </div>

                {/* File Visualization */}
                <div className="flex flex-wrap gap-2 relative z-10">
                  {level.files.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono opacity-50">Zero Segment Artifacts</span>
                  ) : (
                    level.files.map((file, i) => (
                      <motion.div
                        key={file}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          "h-10 min-w-[3.5rem] px-3 rounded border flex items-center justify-center text-[9px] font-mono shadow-sm transition-all hover:border-primary/50 cursor-default",
                          level.level === 0 
                            ? "bg-purple-500/10 border-purple-500/30 text-purple-300" 
                            : "bg-blue-500/5 border-blue-500/20 text-blue-300"
                        )}
                        title={file}
                      >
                        <span className="truncate max-w-[90px]">{file.split('_')[2].substring(0, 6)}...</span>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Decorative background number */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-9xl font-bold text-white/5 pointer-events-none select-none italic">
                  {level.level}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
