import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePutValue, useGetValue, useDeleteValue, useScan } from "@/hooks/use-lsm";
import { ConsoleOutput } from "@/components/ConsoleOutput";
import { Loader2, Search, Trash2, Save, Play, RefreshCw, Terminal, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface LogEntry {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

export default function Console() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { toast } = useToast();

  // Inputs
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [getKey, setGetKey] = useState(""); // Separate state for GET to avoid confusion

  // Scan Inputs
  const [scanStart, setScanStart] = useState("");
  const [scanEnd, setScanEnd] = useState("");
  const [scanLimit, setScanLimit] = useState("10");

  const putMutation = usePutValue();
  const deleteMutation = useDeleteValue();
  
  // We trigger GET manually by invalidating or refetching, but here we just use fetch directly
  // inside the handler to make it feel like a "Console" command rather than a reactive query.
  // However, useQuery is better for state. Let's use a "Fetch" pattern.
  const { refetch: fetchGet, isFetching: isGetting } = useGetValue(getKey, false);
  
  const { data: scanData, refetch: runScan, isFetching: isScanning } = useScan({
    startKey: scanStart || undefined,
    endKey: scanEnd || undefined,
    limit: Number(scanLimit),
  });

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36),
      type,
      message,
      timestamp: new Date()
    }]);
  };

  const handlePut = async () => {
    if (!key) return;
    try {
      await putMutation.mutateAsync({ key, value });
      addLog('success', `PUT ${key} = "${value}"`);
      setValue(""); // Clear value but keep key for convenience
      runScan(); // Refresh scan if active
    } catch (err: any) {
      addLog('error', `PUT Failed: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!key) return;
    try {
      await deleteMutation.mutateAsync(key);
      addLog('warning', `DELETE ${key}`);
      runScan();
    } catch (err: any) {
      addLog('error', `DELETE Failed: ${err.message}`);
    }
  };

  const handleGet = async () => {
    if (!getKey) return;
    try {
      addLog('info', `GET ${getKey}...`);
      const { data } = await fetchGet();
      if (data?.found) {
        addLog('success', `Result: "${data.value}"`);
      } else {
        addLog('warning', `Key "${getKey}" not found`);
      }
    } catch (err: any) {
      addLog('error', `GET Failed: ${err.message}`);
    }
  };

  const handleScan = () => {
    addLog('info', `SCAN range=[${scanStart}, ${scanEnd}) limit=${scanLimit}`);
    runScan();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-8 space-y-6 overflow-y-auto">
          
          <header className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white font-mono">Console</h1>
              <p className="text-muted-foreground mt-1">Execute Key-Value operations directly against the engine.</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="font-mono text-xs">READY</Badge>
              <Badge variant="outline" className="font-mono text-xs text-primary border-primary">V 1.0.0</Badge>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
            {/* Operation Panel */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Single Operation Card */}
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Terminal className="w-4 h-4" /> Single Operation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-4">
                      <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Key</label>
                      <Input 
                        value={key} 
                        onChange={(e) => setKey(e.target.value)} 
                        placeholder="user:101" 
                        className="font-mono border-primary/20 focus:border-primary/50"
                      />
                    </div>
                    <div className="col-span-8">
                      <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Value</label>
                      <Input 
                        value={value} 
                        onChange={(e) => setValue(e.target.value)} 
                        placeholder='{"name": "Alice"}' 
                        className="font-mono border-primary/20 focus:border-primary/50"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handlePut} 
                      disabled={putMutation.isPending || !key}
                      className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 font-mono"
                    >
                      {putMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      PUT
                    </Button>
                    <Button 
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending || !key}
                      variant="destructive"
                      className="bg-red-900/20 text-red-500 hover:bg-red-900/30 border border-red-900/20 font-mono"
                    >
                      {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      DELETE
                    </Button>
                  </div>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-dashed border-border/50" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or Retrieve</span></div>
                  </div>

                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Get Key</label>
                      <Input 
                        value={getKey} 
                        onChange={(e) => setGetKey(e.target.value)} 
                        placeholder="user:101" 
                        className="font-mono"
                      />
                    </div>
                    <Button 
                      onClick={handleGet}
                      disabled={isGetting || !getKey}
                      variant="secondary"
                      className="font-mono"
                    >
                      {isGetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                      GET
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Scan Card */}
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Range Scan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Start Key</label>
                      <Input value={scanStart} onChange={e => setScanStart(e.target.value)} placeholder="a" className="font-mono text-xs" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-mono text-muted-foreground mb-1.5 block">End Key</label>
                      <Input value={scanEnd} onChange={e => setScanEnd(e.target.value)} placeholder="z" className="font-mono text-xs" />
                    </div>
                    <div className="w-20">
                      <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Limit</label>
                      <Input type="number" value={scanLimit} onChange={e => setScanLimit(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <Button onClick={handleScan} disabled={isScanning} size="icon" variant="outline">
                      {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {/* Scan Results */}
                  <div className="rounded-md border bg-black/40 min-h-[150px] max-h-[250px] overflow-auto">
                    <Table>
                      <TableHeader className="bg-muted/30 sticky top-0 backdrop-blur-sm">
                        <TableRow>
                          <TableHead className="w-[150px] font-mono text-xs">Key</TableHead>
                          <TableHead className="font-mono text-xs">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!scanData?.results.length ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-xs text-muted-foreground h-24">
                              {isScanning ? "Scanning..." : "No results or waiting for scan"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          scanData.results.map((kv) => (
                            <TableRow key={kv.key} className="hover:bg-muted/10 transition-colors">
                              <TableCell className="font-mono text-xs text-primary font-medium">{kv.key}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]" title={kv.value}>
                                {kv.value}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Console Output Sidebar */}
            <div className="h-full">
               <ConsoleOutput logs={logs} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
