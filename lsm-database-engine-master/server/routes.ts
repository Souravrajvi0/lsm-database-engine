import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { register } from "./prometheus-metrics";
import { HealthCheckManager } from "./health-check";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Initialize health check manager
  const healthCheck = new HealthCheckManager(storage.lsm);
  
  // === KV Routes ===

  app.get(api.lsm.get.path, async (req, res) => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const value = await storage.get(key);
      res.json({ key, value, found: value !== null });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.lsm.put.path, async (req, res) => {
    try {
      const input = api.lsm.put.input.parse(req.body);
      await storage.put(input);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.lsm.delete.path, async (req, res) => {
    try {
      const input = api.lsm.delete.input.parse(req.body);
      await storage.delete(input.key);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === Batch Operations ===
  app.post('/api/kv/batch/put', async (req, res) => {
    try {
      const { operations } = req.body;
      
      if (!Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json({ 
          message: 'Invalid batch request',
          details: 'operations must be a non-empty array'
        });
      }

      // Validate operations
      const validOperations = operations.every(op => 
        op && typeof op.key === 'string' && typeof op.value === 'string'
      );

      if (!validOperations) {
        return res.status(400).json({ 
          message: 'Invalid batch request',
          details: 'each operation must have key (string) and value (string)'
        });
      }

      await storage.batchPut(operations);
      
      res.json({ 
        success: true,
        count: operations.length
      });
    } catch (err) {
      res.status(500).json({ 
        message: "Batch PUT operation failed",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.post('/api/kv/batch/delete', async (req, res) => {
    try {
      const { keys } = req.body;
      
      if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({ 
          message: 'Invalid batch request',
          details: 'keys must be a non-empty array'
        });
      }

      if (!keys.every(k => typeof k === 'string')) {
        return res.status(400).json({ 
          message: 'Invalid batch request',
          details: 'all keys must be strings'
        });
      }

      await storage.batchDelete(keys);
      
      res.json({ 
        success: true,
        count: keys.length
      });
    } catch (err) {
      res.status(500).json({ 
        message: "Batch DELETE operation failed",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.get(api.lsm.scan.path, async (req, res) => {
    try {
      const query = {
        startKey: req.query.startKey as string | undefined,
        endKey: req.query.endKey as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined
      };
      
      const input = api.lsm.scan.input.parse(query);
      const results = await storage.scan(input);
      res.json({ results });
    } catch (err) {
       res.status(500).json({ message: "Internal server error" });
    }
  });

  // === System Routes ===

  app.get(api.lsm.stats.path, async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.post(api.lsm.compact.path, async (req, res) => {
    storage.triggerCompaction();
    res.status(202).json({ message: "Compaction triggered" });
  });

  // === Prometheus Metrics Endpoint ===
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.send(await register.metrics());
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to retrieve metrics",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // === Legacy Metrics Endpoint (for backward compatibility) ===
  app.get('/api/metrics', async (req, res) => {
    try {
      const metrics = storage.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve metrics" });
    }
  });

  // === Health Check Endpoint ===
  app.get('/health', async (req, res) => {
    try {
      const health = await healthCheck.performHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : (health.status === 'degraded' ? 503 : 503);
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        uptime: process.uptime(),
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // === Benchmark Route ===
  app.post(api.lsm.benchmark.path, async (req, res) => {
    const { type, count } = req.body;
    const startTime = Date.now();
    
    if (type === 'write') {
      for (let i = 0; i < count; i++) {
        const key = `bench_k_${Date.now()}_${i}`;
        const val = `bench_value_${i}_${Math.random()}`;
        await storage.put({ key, value: val });
      }
    } else {
      // Read benchmark (random reads)
      // First get some keys to read
      const all = await storage.scan({ limit: 100 });
      if (all.length > 0) {
        for (let i = 0; i < count; i++) {
            const r = all[Math.floor(Math.random() * all.length)];
            await storage.get(r.key);
        }
      }
    }

    const duration = Date.now() - startTime;
    res.json({
        operation: type,
        count,
        durationMs: duration,
        opsPerSec: Math.round(count / (duration / 1000))
    });
  });

  return httpServer;
}
