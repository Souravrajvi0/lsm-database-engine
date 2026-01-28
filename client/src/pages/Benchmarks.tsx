import { Sidebar } from "@/components/Sidebar";
import { useBenchmark } from "@/hooks/use-lsm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Zap, Database, BarChart3, ArrowRight } from "lucide-react";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { BenchmarkResult } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function Benchmarks() {
  const [writeCount, setWriteCount] = useState("1000");
  const [readCount, setReadCount] = useState("1000");
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  
  const benchmarkMutation = useBenchmark();

  const runBenchmark = async (type: 'write' | 'read', countStr: string) => {
    const count = parseInt(countStr);
    if (isNaN(count) || count <= 0) return;

    try {
      const result = await benchmarkMutation.mutateAsync({ type, count });
      setResults(prev => [...prev, result]);
    } catch (err) {
      console.error(err);
    }
  };

  const chartData = results.map((r, i) => ({
    name: `#${i+1} ${r.operation.toUpperCase()}`,
    ops: r.opsPerSec,
    type: r.operation
  }));

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-3">
            Benchmarks
          </h1>
          <p className="text-muted-foreground mt-1">Measure the performance of the LSM engine.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Write Benchmark */}
          <Card className="border-primary/20 bg-card">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-primary">
                 <Database className="w-5 h-5" /> Write Performance
               </CardTitle>
               <CardDescription>Sequential write test (PUT operations)</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-xs font-mono text-muted-foreground mb-1 block">Item Count</label>
                   <Input 
                      type="number" 
                      value={writeCount} 
                      onChange={(e) => setWriteCount(e.target.value)}
                      className="font-mono"
                   />
                 </div>
                 <Button 
                    className="self-end bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
                    onClick={() => runBenchmark('write', writeCount)}
                    disabled={benchmarkMutation.isPending}
                 >
                    {benchmarkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Zap className="w-4 h-4 mr-2"/>}
                    Run Writes
                 </Button>
               </div>
             </CardContent>
          </Card>

          {/* Read Benchmark */}
          <Card className="border-blue-500/20 bg-card">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-blue-400">
                 <BarChart3 className="w-5 h-5" /> Read Performance
               </CardTitle>
               <CardDescription>Random read test (GET operations)</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-xs font-mono text-muted-foreground mb-1 block">Item Count</label>
                   <Input 
                      type="number" 
                      value={readCount} 
                      onChange={(e) => setReadCount(e.target.value)}
                      className="font-mono"
                   />
                 </div>
                 <Button 
                    className="self-end bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/20"
                    onClick={() => runBenchmark('read', readCount)}
                    disabled={benchmarkMutation.isPending}
                 >
                    {benchmarkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Zap className="w-4 h-4 mr-2"/>}
                    Run Reads
                 </Button>
               </div>
             </CardContent>
          </Card>
        </div>

        {/* Results Chart */}
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Results History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
               {results.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 border-2 border-dashed rounded-lg">
                    <BarChart3 className="w-12 h-12 mb-2" />
                    <p>Run a benchmark to see results</p>
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis 
                        dataKey="name" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(20,20,30,0.9)', border: '1px solid #333' }}
                        itemStyle={{ fontFamily: 'monospace' }}
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      />
                      <Bar dataKey="ops" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.type === 'write' ? 'hsl(var(--primary))' : '#60a5fa'} />
                        ))}
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
               )}
            </div>
            
            {/* Detailed Table */}
            {results.length > 0 && (
              <div className="mt-8 rounded-md border">
                <table className="w-full text-sm">
                   <thead className="bg-muted/50 border-b">
                     <tr>
                       <th className="px-4 py-3 text-left font-mono text-muted-foreground font-medium">Type</th>
                       <th className="px-4 py-3 text-left font-mono text-muted-foreground font-medium">Items</th>
                       <th className="px-4 py-3 text-left font-mono text-muted-foreground font-medium">Duration</th>
                       <th className="px-4 py-3 text-left font-mono text-muted-foreground font-medium">Throughput</th>
                     </tr>
                   </thead>
                   <tbody>
                     {results.map((r, i) => (
                       <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                         <td className="px-4 py-3 font-mono uppercase">
                           <span className={cn(
                             "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                             r.operation === 'write' ? "bg-green-400/10 text-green-400 ring-green-400/20" : "bg-blue-400/10 text-blue-400 ring-blue-400/20"
                           )}>
                             {r.operation}
                           </span>
                         </td>
                         <td className="px-4 py-3 font-mono">{r.count.toLocaleString()}</td>
                         <td className="px-4 py-3 font-mono text-muted-foreground">{r.durationMs} ms</td>
                         <td className="px-4 py-3 font-mono font-bold text-white">{Math.round(r.opsPerSec).toLocaleString()} ops/sec</td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
