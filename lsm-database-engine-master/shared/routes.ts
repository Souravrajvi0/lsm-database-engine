import { z } from 'zod';
import {
  kvPairSchema,
  putRequestSchema,
  scanRequestSchema,
  deleteRequestSchema
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  lsm: {
    // Basic CRUD
    get: {
      method: 'GET' as const,
      path: '/api/lsm/key/:key',
      responses: {
        200: z.object({
          key: z.string(),
          value: z.string().nullable(),
          found: z.boolean(),
        }),
        404: errorSchemas.notFound,
      },
    },
    put: {
      method: 'POST' as const,
      path: '/api/lsm/put',
      input: putRequestSchema,
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'POST' as const, // Using POST for delete action to allow body if needed, or DELETE with param
      path: '/api/lsm/delete',
      input: deleteRequestSchema,
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
    scan: {
      method: 'GET' as const,
      path: '/api/lsm/scan',
      input: scanRequestSchema,
      responses: {
        200: z.object({
          results: z.array(kvPairSchema),
          nextKey: z.string().optional(),
        }),
      },
    },

    // System Operations
    stats: {
      method: 'GET' as const,
      path: '/api/lsm/stats',
      responses: {
        200: z.object({
          memTableSize: z.number(),
          walSize: z.number(),
          levels: z.array(z.object({
            level: z.number(),
            fileCount: z.number(),
            totalSize: z.number(),
            files: z.array(z.string()),
          })),
          isCompacting: z.boolean(),
          metrics: z.object({
            totalWrites: z.number(),
            totalReads: z.number(),
            avgWriteLatencyMs: z.number(),
            avgReadLatencyMs: z.number(),
            lastFlushDurationMs: z.number(),
            lastCompactionDurationMs: z.number(),
            writeAmplification: z.number(),
            bloomFilterHits: z.number(),
            bloomFilterMisses: z.number(),
          }),
        }),
      },
    },
    compact: {
      method: 'POST' as const,
      path: '/api/lsm/compact',
      responses: {
        202: z.object({ message: z.string(), compactionId: z.string().optional() }),
      },
    },

    // Benchmarking
    benchmark: {
      method: 'POST' as const,
      path: '/api/lsm/benchmark',
      input: z.object({
        type: z.enum(['write', 'read']),
        count: z.number().min(1).max(100000),
      }),
      responses: {
        200: z.object({
          operation: z.enum(['write', 'read']),
          count: z.number(),
          durationMs: z.number(),
          opsPerSec: z.number(),
        }),
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
