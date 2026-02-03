import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We don't strictly use Postgres for the LSM data (since we are building our own DB!), 
// but we might use this for user preferences or metadata if needed.
// For now, we mainly define the TYPES for our LSM Engine API.

// === LSM Engine Types ===

// Basic Key-Value Pair
export const kvPairSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(), // Value can be empty string
});
export type KVPair = z.infer<typeof kvPairSchema>;

// Request types
export const putRequestSchema = kvPairSchema;
export type PutRequest = KVPair;

export const getRequestSchema = z.object({
  key: z.string(),
});

export const deleteRequestSchema = z.object({
  key: z.string(),
});

export const scanRequestSchema = z.object({
  startKey: z.string().optional(),
  endKey: z.string().optional(),
  limit: z.coerce.number().optional().default(20),
});
export type ScanRequest = z.infer<typeof scanRequestSchema>;

// Response types
export interface GetResponse {
  key: string;
  value: string | null; // null if not found
  found: boolean;
}

export interface ScanResponse {
  results: KVPair[];
  nextKey?: string;
}

// Stats / Visualization Types
export interface LsmStats {
  memTableSize: number; // Number of entries or bytes
  walSize: number; // Bytes
  levels: {
    level: number;
    fileCount: number;
    totalSize: number; // Bytes
    files: string[]; // Filenames
  }[];
  isCompacting: boolean;
  metrics: {
    totalWrites: number;
    totalReads: number;
    avgWriteLatencyMs: number;
    avgReadLatencyMs: number;
    lastFlushDurationMs: number;
    lastCompactionDurationMs: number;
    writeAmplification: number;
  };
}

// Benchmark Types
export interface BenchmarkResult {
  operation: "write" | "read";
  count: number;
  durationMs: number;
  opsPerSec: number;
}
