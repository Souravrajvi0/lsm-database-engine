import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { PutRequest, ScanRequest } from "@shared/schema";
import { z } from "zod";

// ============================================
// LSM Engine Hooks
// ============================================

// GET /api/lsm/key/:key
export function useGetValue(key: string, enabled: boolean = false) {
  return useQuery({
    queryKey: [api.lsm.get.path, key],
    queryFn: async () => {
      const url = buildUrl(api.lsm.get.path, { key });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) {
        return { key, value: null, found: false };
      }
      if (!res.ok) throw new Error('Failed to fetch value');
      return api.lsm.get.responses[200].parse(await res.json());
    },
    enabled: enabled && !!key,
    retry: false,
  });
}

// POST /api/lsm/put
export function usePutValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PutRequest) => {
      const validated = api.lsm.put.input.parse(data);
      const res = await fetch(api.lsm.put.path, {
        method: api.lsm.put.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.lsm.put.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Failed to put value');
      }
      return api.lsm.put.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [api.lsm.scan.path] });
      queryClient.invalidateQueries({ queryKey: [api.lsm.stats.path] });
    },
  });
}

// POST /api/lsm/delete
export function useDeleteValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(api.lsm.delete.path, {
        method: api.lsm.delete.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to delete value');
      return api.lsm.delete.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.lsm.scan.path] });
      queryClient.invalidateQueries({ queryKey: [api.lsm.stats.path] });
    },
  });
}

// GET /api/lsm/scan
export function useScan(params: ScanRequest) {
  return useQuery({
    queryKey: [api.lsm.scan.path, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.startKey) queryParams.set('startKey', params.startKey);
      if (params.endKey) queryParams.set('endKey', params.endKey);
      if (params.limit) queryParams.set('limit', params.limit.toString());
      
      const url = `${api.lsm.scan.path}?${queryParams.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to scan');
      return api.lsm.scan.responses[200].parse(await res.json());
    },
  });
}

// GET /api/lsm/stats
export function useLsmStats(refetchInterval: number | false = 2000) {
  return useQuery({
    queryKey: [api.lsm.stats.path],
    queryFn: async () => {
      const res = await fetch(api.lsm.stats.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return api.lsm.stats.responses[200].parse(await res.json());
    },
    refetchInterval,
  });
}

// POST /api/lsm/compact
export function useCompact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.lsm.compact.path, {
        method: api.lsm.compact.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to trigger compaction');
      // 202 response
      return await res.json();
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: [api.lsm.stats.path] });
    }
  });
}

// POST /api/lsm/benchmark
export function useBenchmark() {
  return useMutation({
    mutationFn: async (data: { type: 'write' | 'read', count: number }) => {
      const res = await fetch(api.lsm.benchmark.path, {
        method: api.lsm.benchmark.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Benchmark failed');
      return api.lsm.benchmark.responses[200].parse(await res.json());
    },
  });
}
