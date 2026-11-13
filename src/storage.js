import { applyAction, emptyData } from "./core.js";
import { cloudEnabled, cloudRequest } from "./cloud.js";

// Keep the key and envelope from the uploaded HTML to retain records on the same origin.
export const STORAGE_KEY = "zhen-atitai-offline-records-v1";
const storageError = "本机存储不可用或已损坏，请使用普通浏览器打开文件，并允许本地存储。";
const conflictError = "数据已更新，请刷新后重试";
const reply = (payload, status = 200) => Response.json(payload, { status });

export function readSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { data: emptyData(), version: 0 };
  const snapshot = JSON.parse(raw);
  const data = typeof snapshot.data === "string" ? JSON.parse(snapshot.data) : snapshot.data;
  if (!data || !Number.isInteger(snapshot.version) || snapshot.version < 1
    || !["phones", "customers", "sales", "payments"].every((key) => Array.isArray(data[key]))) {
    throw Error(storageError);
  }
  return { data, version: snapshot.version };
}

export async function localRequest(_url, options = {}) {
  if (cloudEnabled) return cloudRequest(_url, options);
  try {
    if (options.method !== "POST") {
      const probe = `${STORAGE_KEY}:probe`;
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return reply(readSnapshot());
    }
    const commit = () => {
      const { action, item, version } = JSON.parse(options.body);
      const current = readSnapshot();
      if (current.version !== version) return reply({ error: conflictError }, 409);
      let data;
      try {
        data = applyAction(current.data, action, item);
      } catch (error) {
        return reply({ error: error.message }, 400);
      }
      const nextVersion = version + 1;
      // No await between reading the snapshot and the synchronous storage write.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: JSON.stringify(data), version: nextVersion }));
      return reply({ data, version: nextVersion });
    };
    if (globalThis.navigator?.locks) return await navigator.locks.request(STORAGE_KEY, commit);
    return commit();
  } catch {
    return reply({ error: storageError }, 500);
  }
}

export async function downloadBackup() {
  try {
    let snapshot;
    if (cloudEnabled) {
      const response = await cloudRequest("/api/data");
      if (!response.ok) throw Error("Backup failed");
      snapshot = await response.json();
    } else snapshot = readSnapshot();
    const { data } = snapshot;
    const payload = { format: "ZHEN_ATITAI_OFFLINE_BACKUP", formatVersion: 1, exportedAt: new Date().toISOString(), data };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ZHEN_ATITAI_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    const language = document.documentElement.lang;
    alert(language === "id" ? "Cadangan gagal dibuat. Penyimpanan lokal tidak tersedia atau rusak." : storageError);
  }
}
