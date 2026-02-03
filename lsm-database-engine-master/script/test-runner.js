import process from "process";

const baseUrl = process.env.BASE_URL || "http://localhost:5000";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function put(key, value) {
  return request("POST", "/api/lsm/put", { key, value });
}

async function get(key) {
  return request("GET", `/api/lsm/key/${encodeURIComponent(key)}`);
}

async function del(key) {
  return request("POST", "/api/lsm/delete", { key });
}

async function scan(params) {
  const query = new URLSearchParams();
  if (params?.startKey) query.set("startKey", params.startKey);
  if (params?.endKey) query.set("endKey", params.endKey);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request("GET", `/api/lsm/scan${qs ? `?${qs}` : ""}`);
}

async function stats() {
  return request("GET", "/api/lsm/stats");
}

async function compact() {
  return request("POST", "/api/lsm/compact");
}

function log(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function phase1() {
  const prefix = "p1_k_";
  const values = new Map();
  let writeSuccess = 0;
  let readSuccess = 0;
  const mismatches = [];

  for (let i = 0; i < 100; i++) {
    const key = `${prefix}${String(i).padStart(3, "0")}`;
    const value = `value_${i}`;
    const res = await put(key, value);
    if (res.status === 200 && res.data?.success) writeSuccess++;
    values.set(key, value);
  }

  for (let i = 0; i < 100; i++) {
    const key = `${prefix}${String(i).padStart(3, "0")}`;
    const res = await get(key);
    if (res.status === 200 && res.data?.value === values.get(key)) {
      readSuccess++;
    } else {
      mismatches.push({ key, expected: values.get(key), got: res.data });
    }
  }

  for (let i = 0; i < 50; i++) {
    const key = `${prefix}${String(i).padStart(3, "0")}`;
    const value = `updated_${i}`;
    await put(key, value);
    values.set(key, value);
  }

  for (let i = 0; i < 25; i++) {
    const key = `${prefix}${String(i).padStart(3, "0")}`;
    await del(key);
    values.set(key, null);
  }

  let verifySuccess = 0;
  for (let i = 0; i < 100; i++) {
    const key = `${prefix}${String(i).padStart(3, "0")}`;
    const res = await get(key);
    const expected = values.get(key);
    const got = res.data?.value;
    if (expected === got) {
      verifySuccess++;
    } else {
      mismatches.push({ key, expected, got: res.data });
    }
  }

  log({
    phase: "phase1",
    writeSuccess,
    readSuccess,
    verifySuccess,
    mismatches,
  });
}

async function phase2Write() {
  const total = Number(process.env.PHASE2_TOTAL || 300);
  const prefix = "p2_k_";
  const batchSize = 50;
  const batches = Math.ceil(total / batchSize);
  const flushLogs = [];

  let idx = 0;
  for (let b = 0; b < batches; b++) {
    for (let i = 0; i < batchSize && idx < total; i++, idx++) {
      const key = `${prefix}${String(idx).padStart(4, "0")}`;
      const value = `p2_val_${idx}`;
      await put(key, value);
    }
    await delay(200);
    const s = await stats();
    flushLogs.push({
      batch: b + 1,
      totalWritten: idx,
      levels: s.data?.levels || [],
      isCompacting: s.data?.isCompacting,
    });
  }

  log({
    phase: "phase2_write",
    totalWritten: total,
    flushLogs,
  });
}

async function phase2Verify() {
  const total = Number(process.env.PHASE2_TOTAL || 300);
  const prefix = "p2_k_";
  let missing = 0;
  const missingKeys = [];

  for (let i = 0; i < total; i++) {
    const key = `${prefix}${String(i).padStart(4, "0")}`;
    const res = await get(key);
    if (!res.data?.found || res.data?.value === null) {
      missing++;
      missingKeys.push(key);
    }
  }

  log({
    phase: "phase2_verify",
    totalChecked: total,
    missing,
    missingKeys,
  });
}

async function phase3() {
  const total = Number(process.env.PHASE3_TOTAL || 240);
  const prefix = "p3_k_";
  const deleted = new Set();

  for (let i = 0; i < total; i++) {
    const key = `${prefix}${String(i).padStart(4, "0")}`;
    await put(key, `p3_val_${i}`);
  }

  for (let i = 0; i < 20; i++) {
    const key = `${prefix}${String(i).padStart(4, "0")}`;
    await del(key);
    deleted.add(key);
  }

  let s = await stats();
  if (!s.data?.isCompacting) {
    await compact();
  }

  const readErrors = [];
  let compactionStarted = false;
  for (let i = 0; i < 60; i++) {
    s = await stats();
    if (s.data?.isCompacting) compactionStarted = true;
    if (s.data?.isCompacting) {
      const key = `${prefix}${String(Math.floor(Math.random() * total)).padStart(4, "0")}`;
      const res = await get(key);
      if (res.status !== 200) {
        readErrors.push({ key, status: res.status, data: res.data });
      }
    }
    await delay(200);
  }

  const missing = [];
  const duplicates = [];
  const seen = new Set();

  const scanRes = await scan({ startKey: prefix, endKey: `${prefix}~`, limit: 5000 });
  const results = scanRes.data?.results || [];
  for (const kv of results) {
    if (seen.has(kv.key)) duplicates.push(kv.key);
    seen.add(kv.key);
  }

  for (let i = 0; i < total; i++) {
    const key = `${prefix}${String(i).padStart(4, "0")}`;
    const res = await get(key);
    const shouldBeMissing = deleted.has(key);
    if (shouldBeMissing && res.data?.value !== null) missing.push({ key, expected: null, got: res.data });
    if (!shouldBeMissing && res.data?.value === null) missing.push({ key, expected: `p3_val_${i}`, got: res.data });
  }

  s = await stats();

  log({
    phase: "phase3",
    totalWritten: total,
    deletedCount: deleted.size,
    compactionStarted,
    finalLevels: s.data?.levels || [],
    readErrorsDuringCompaction: readErrors,
    missingOrIncorrect: missing,
    duplicateKeysInScan: duplicates,
    scanCount: results.length,
  });
}

async function phase4() {
  const total = Number(process.env.PHASE4_TOTAL || 500);
  const prefix = "p4_k_";

  for (let i = 0; i < total; i++) {
    await put(`${prefix}${String(i).padStart(4, "0")}`, `p4_val_${i}`);
  }

  const before = await stats();
  const bHits = before.data?.metrics?.bloomFilterHits || 0;
  const bMiss = before.data?.metrics?.bloomFilterMisses || 0;

  for (let i = 0; i < total; i++) {
    await get(`${prefix}${String(i).padStart(4, "0")}`);
  }

  const afterExisting = await stats();
  const eHits = afterExisting.data?.metrics?.bloomFilterHits || 0;
  const eMiss = afterExisting.data?.metrics?.bloomFilterMisses || 0;

  for (let i = 0; i < total; i++) {
    await get(`p4_missing_${String(i).padStart(4, "0")}`);
  }

  const afterMissing = await stats();
  const mHits = afterMissing.data?.metrics?.bloomFilterHits || 0;
  const mMiss = afterMissing.data?.metrics?.bloomFilterMisses || 0;

  const existingHits = eHits - bHits;
  const existingMiss = eMiss - bMiss;
  const missingHits = mHits - eHits;
  const missingMiss = mMiss - eMiss;

  const existingEfficiency = existingHits + existingMiss > 0
    ? (existingHits / (existingHits + existingMiss)) * 100
    : 0;
  const missingEfficiency = missingHits + missingMiss > 0
    ? (missingHits / (missingHits + missingMiss)) * 100
    : 0;

  log({
    phase: "phase4",
    bloomStats: {
      before: { hits: bHits, misses: bMiss },
      afterExisting: { hits: eHits, misses: eMiss },
      afterMissing: { hits: mHits, misses: mMiss },
    },
    deltas: {
      existing: { hits: existingHits, misses: existingMiss, efficiencyPct: existingEfficiency },
      missing: { hits: missingHits, misses: missingMiss, efficiencyPct: missingEfficiency },
    }
  });
}

async function phase5() {
  const prefix = "p5_k_";
  const writeErrors = [];
  const readErrors = [];

  const writes = Array.from({ length: 50 }, async (_, i) => {
    const res = await put(`${prefix}${String(i).padStart(3, "0")}`, `p5_val_${i}`);
    if (res.status !== 200) writeErrors.push({ i, res });
  });

  const extraWrites = Array.from({ length: 120 }, async (_, i) => {
    const res = await put(`${prefix}x_${String(i).padStart(3, "0")}`, `p5_x_${i}`);
    if (res.status !== 200) writeErrors.push({ i, res });
  });

  const reads = Array.from({ length: 80 }, async () => {
    const key = `${prefix}${String(Math.floor(Math.random() * 50)).padStart(3, "0")}`;
    const res = await get(key);
    if (res.status !== 200) readErrors.push({ key, res });
  });

  await Promise.all([...writes, ...reads, ...extraWrites]);

  const missing = [];
  for (let i = 0; i < 50; i++) {
    const key = `${prefix}${String(i).padStart(3, "0")}`;
    const res = await get(key);
    if (!res.data?.found || res.data?.value === null) missing.push(key);
  }

  log({
    phase: "phase5",
    writeErrors,
    readErrors,
    missingKeys: missing,
  });
}

async function phase7() {
  const results = {};

  results.emptyKey = await request("POST", "/api/lsm/put", { key: "", value: "" });

  const largeValue = "a".repeat(1024 * 1024 + 10);
  results.largeValuePut = await put("p7_large", largeValue);
  results.largeValueGet = await get("p7_large");
  results.largeValueLength = results.largeValueGet?.data?.value?.length || 0;

  results.unicodePut = await put("????--??", "unicode_val");
  results.unicodeGet = await get("????--??");

  for (let i = 0; i < 20; i++) {
    await put("p7_hot", `hot_${i}`);
  }
  results.hotKeyFinal = await get("p7_hot");

  results.scanEmpty = await scan({ limit: 50 });
  results.scanInvalidRange = await scan({ startKey: "z", endKey: "a", limit: 50 });

  log({ phase: "phase7", results });
}

const phase = process.argv[2];

const runners = {
  phase1,
  phase2_write: phase2Write,
  phase2_verify: phase2Verify,
  phase3,
  phase4,
  phase5,
  phase7,
};

if (!phase || !runners[phase]) {
  console.error("Usage: node script/test-runner.js <phase>");
  process.exit(1);
}

await runners[phase]();
