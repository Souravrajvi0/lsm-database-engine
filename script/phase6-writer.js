import process from "process";

const baseUrl = process.env.BASE_URL || "http://localhost:5000";
const prefix = process.env.PHASE6_PREFIX || "p6_k_";
const total = Number(process.env.PHASE6_TOTAL || 200);
const delayMs = Number(process.env.PHASE6_DELAY || 20);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function put(key, value) {
  const res = await fetch(`${baseUrl}/api/lsm/put`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  return res.status;
}

for (let i = 0; i < total; i++) {
  const key = `${prefix}${String(i).padStart(4, "0")}`;
  const status = await put(key, `p6_val_${i}`);
  console.log(JSON.stringify({ i, key, status }));
  await delay(delayMs);
}
