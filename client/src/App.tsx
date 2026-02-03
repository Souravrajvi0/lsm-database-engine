import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Console from "@/pages/Console";
import Visualizer from "@/pages/Visualizer";
import Benchmarks from "@/pages/Benchmarks";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Console} />
      <Route path="/visualizer" component={Visualizer} />
      <Route path="/benchmarks" component={Benchmarks} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
