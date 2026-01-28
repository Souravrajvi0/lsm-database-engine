import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";

interface LogEntry {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

interface ConsoleOutputProps {
  logs: LogEntry[];
}

export function ConsoleOutput({ logs }: ConsoleOutputProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="h-full flex flex-col rounded-lg border bg-black/50 font-mono text-sm shadow-inner">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <span className="text-xs text-muted-foreground">Output Log</span>
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-500/50" />
          <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
          <div className="h-2 w-2 rounded-full bg-green-500/50" />
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        {logs.length === 0 ? (
          <div className="text-muted-foreground italic opacity-50">
            Waiting for operations...
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2 font-mono">
                <span className="text-muted-foreground shrink-0 select-none">
                  [{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}]
                </span>
                <span className={
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'warning' ? 'text-yellow-400' :
                  'text-blue-300'
                }>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
