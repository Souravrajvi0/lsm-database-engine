import { Link, useLocation } from "wouter";
import { Terminal, Activity, BarChart3, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Console", href: "/", icon: Terminal },
  { name: "Visualizer", href: "/visualizer", icon: Activity },
  { name: "Benchmarks", href: "/benchmarks", icon: BarChart3 },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Database className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight text-white font-mono">
          LSM Engine
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "group flex items-center rounded-md px-4 py-3 text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-white"
                  )}
                />
                {item.name}
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="rounded-lg bg-muted/50 p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            System Status
          </h4>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-mono text-green-500">ENGINE ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
