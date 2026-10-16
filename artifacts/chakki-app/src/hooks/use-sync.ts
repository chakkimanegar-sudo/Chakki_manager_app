import { useState, useEffect, useCallback, useRef } from "react";

const SHOP_CODE_KEY = "chakki_shop_code";
const LAST_SYNC_KEY = "chakki_last_sync";
const LAST_SERVER_AT_KEY = "chakki_last_server_at";
const LAST_SERVER_SNAPSHOT_KEY = "chakki_last_server_snapshot";

const API_SERVER_URL_KEY = "chakki_api_server_url";
const RESTORE_PENDING_SYNC_KEY = "chakki_restore_pending_sync";

function getApiBase(): string {
  const configured = localStorage.getItem(API_SERVER_URL_KEY)?.trim();
  if (configured) {
    const base = configured.replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }

  const native = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor?.isNativePlatform?.();
  const nativeLocalOrigin =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    !window.location.port;

  if (native || nativeLocalOrigin) {
    throw new Error(
      "APK ka Sync Server URL set nahi hai. Pehle Settings mein apne published Replit app ka HTTPS URL save karein.",
    );
  }

  return "/api";
}

async function requestApiJSON<T>(
  url: string,
  init: RequestInit | undefined,
  action: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new Error("Sync server se connection nahi ho pa raha. Internet aur server URL check karein.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();
  let parsed: unknown;

  if (!contentType.toLowerCase().includes("application/json")) {
    if (/^\s*<!doctype html/i.test(raw) || /^\s*<html/i.test(raw) || raw.includes("<!DOCTYPE")) {
      throw new Error(
        "Sync server ne JSON ki jagah HTML page bheja. APK mein sahi published Replit URL set karein aur dekhein ki us URL par /api/health chal raha hai.",
      );
    }
    throw new Error("Sync server ka jawab JSON nahi hai. Server URL aur deployment check karein.");
  }

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Sync server ka JSON jawab galat hai. Server deployment check karein.");
  }

  if (!response.ok) {
    const body = parsed && typeof parsed === "object"
      ? parsed as { error?: string }
      : {};
    throw new Error(body.error || `${action} fail hua (HTTP ${response.status})`);
  }

  return parsed as T;
}

export function validateApiServerUrl(value: string): { success: boolean; value?: string; error?: string } {
  const trimmed = value.trim().replace(/\\/+$/, "");
  if (!trimmed) return { success: true, value: "" };

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      return { success: false, error: "Server URL HTTPS hona chahiye." };
    }
    if (url.search || url.hash) {
      return { success: false, error: "URL mein ? ya # ke baad text nahi hona chahiye." };
    }
    const base = url.origin + url.pathname.replace(/\/+$/, "");
    return { success: true, value: base };
  } catch {
    return { success: false, error: "Sahi server URL daalein, jaise https://aapka-app.replit.app" };
  }
}

const LS_RECORDS = "chakki_records";
const LS_CUSTOMERS = "khata_customers";
const LS_TRANSACTIONS = "khata_transactions";
const LS_SETTINGS = "chakki_settings";

export type SyncStatus =
  | "idle"
  | "syncing"
  | "synced"
  | "error"
  | "offline"
  | "not-setup";

type Snapshot = {
  records: unknown[];
  customers: unknown[];
  transactions: unknown[];
  settings: Record<string, number>;
};

type ServerResponse = Snapshot & {
  shopId: string;
  updatedAt: string;
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    const json = JSON.stringify(value);
    localStorage.setItem(key, json);
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: json }),
    );
  } catch {}
}

function getLocalSnapshot(): Snapshot {
  return {
    records: readJSON<unknown[]>(LS_RECORDS, []),
    customers: readJSON<unknown[]>(LS_CUSTOMERS, []),
    transactions: readJSON<unknown[]>(LS_TRANSACTIONS, []),
    settings: readJSON<Record<string, number>>(LS_SETTINGS, {}),
  };
}

function snapshotEquals(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeMobile(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Repair missing Khata links for older Udhar records. */
function reconcileKhataSnapshot(snapshot: Snapshot): Snapshot {
  const customers = [...snapshot.customers];
  const transactions = [...snapshot.transactions];
  let changed = false;

  for (const rawRecord of snapshot.records) {
    const record = asObject(rawRecord);
    if (!record || record.paymentType !== "udhar") continue;

    const recordId = typeof record.id === "string" ? record.id : "";
    const customerName = String(record.customerName ?? "").trim();

    if (
      !recordId ||
      !customerName ||
      transactions.some((rawTransaction) => asObject(rawTransaction)?.recordId === recordId)
    ) {
      continue;
    }

    const nameKey = normalizeName(customerName);
    const mobile = normalizeMobile(record.mobile);
    let customer = customers.map(asObject).find((candidate) => {
      if (!candidate) return false;
      const sameName = normalizeName(candidate.name) === nameKey;
      const candidateMobile = normalizeMobile(candidate.mobile);
      return sameName && (!mobile || candidateMobile === mobile);
    });

    if (!customer) {
      customer = {
        id: crypto.randomUUID(),
        name: customerName,
        mobile,
        village: String(record.village ?? "").trim(),
        createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
      };
      customers.push(customer);
      changed = true;
    }

    const customerId = typeof customer.id === "string" ? customer.id : "";
    if (!customerId) continue;

    const amount = typeof record.total === "number" ? record.total : Number(record.total);
    const kg = typeof record.kg === "number" ? record.kg : undefined;
    const anaj = typeof record.anaj === "string" ? record.anaj : undefined;
    const date = typeof record.date === "string" ? record.date : "";

    const matchingUnlinkedTransactionIndex = transactions.findIndex((rawTransaction) => {
      const transaction = asObject(rawTransaction);
      return (
        !!transaction &&
        transaction.type === "udhar" &&
        !transaction.recordId &&
        transaction.customerId === customerId &&
        transaction.amount === amount &&
        transaction.date === date &&
        transaction.kg === kg &&
        transaction.anaj === anaj
      );
    });

    if (matchingUnlinkedTransactionIndex >= 0) {
      const transaction = asObject(transactions[matchingUnlinkedTransactionIndex]);
      if (transaction) {
        transactions[matchingUnlinkedTransactionIndex] = { ...transaction, recordId };
        changed = true;
      }
      continue;
    }

    transactions.push({
      id: crypto.randomUUID(),
      customerId,
      type: "udhar",
      amount,
      anaj,
      kg,
      rate: typeof record.rate === "number" ? record.rate : undefined,
      date,
      notes: String(record.notes ?? ""),
      recordId,
      createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
    });
    changed = true;
  }

  return changed ? { ...snapshot, customers, transactions } : snapshot;
}

function saveSnapshot(snapshot: Snapshot) {
  writeJSON(LS_RECORDS, snapshot.records);
  writeJSON(LS_CUSTOMERS, snapshot.customers);
  writeJSON(LS_TRANSACTIONS, snapshot.transactions);
  writeJSON(LS_SETTINGS, snapshot.settings);
}

function getLastServerSnapshot(): Snapshot {
  return readJSON<Snapshot>(LAST_SERVER_SNAPSHOT_KEY, {
    records: [], customers: [], transactions: [], settings: {},
  });
}

function saveLastServerSnapshot(snapshot: Snapshot) {
  try {
    localStorage.setItem(LAST_SERVER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {}
}

async function apiJoinShop(code: string): Promise<{
  id: string; code: string; name: string; isNew: boolean;
}> {
  return requestApiJSON(`${getApiBase()}/shop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.toUpperCase() }),
  }, "Shop connect");
}

async function apiGetData(code: string): Promise<ServerResponse> {
  return requestApiJSON(
    `${getApiBase()}/shop/${code.toUpperCase()}/data`,
    undefined,
    "Data fetch",
  );
}

async function apiPushData(
  code: string,
  snapshot: Snapshot,
  base: Snapshot,
): Promise<ServerResponse> {
  return requestApiJSON(
    `${getApiBase()}/shop/${code.toUpperCase()}/data`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...snapshot, base }),
    },
    "Data sync",
  );
}

function markSynced(updatedAt: string) {
  localStorage.setItem(LAST_SERVER_AT_KEY, updatedAt);
  const timeStr = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
  localStorage.setItem(LAST_SYNC_KEY, timeStr);
  return timeStr;
}

export function useSync() {
  const [shopCode, setShopCode] = useState<string>(
    () => localStorage.getItem(SHOP_CODE_KEY) ?? "",
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    localStorage.getItem(SHOP_CODE_KEY) ? "idle" : "not-setup",
  );
  const [lastSyncTime, setLastSyncTime] = useState<string>(
    () => localStorage.getItem(LAST_SYNC_KEY) ?? "",
  );
  const [apiServerUrl, setApiServerUrlState] = useState<string>(
    () => localStorage.getItem(API_SERVER_URL_KEY) ?? "",
  );

  const saveApiServerUrl = useCallback((value: string) => {
    const result = validateApiServerUrl(value);
    if (!result.success) return result;
    if (result.value) localStorage.setItem(API_SERVER_URL_KEY, result.value);
    else localStorage.removeItem(API_SERVER_URL_KEY);
    setApiServerUrlState(result.value ?? "");
    return { success: true };
  }, []);

  const testApiConnection = useCallback(async () => {
    try {
      const health = await requestApiJSON<{ status?: string }>(
        `${getApiBase()}/health`,
        undefined,
        "Server check",
      );
      if (health.status !== "ok") {
        return { success: false, error: "Server chal raha hai, lekin health response sahi nahi hai." };
      }
      return { success: true, error: "" };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Server se connection nahi hua." };
    }
  }, []);

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushInFlightRef = useRef<Promise<boolean> | null>(null);
  const pushToServerRef = useRef<(code: string) => Promise<boolean>>(
    async () => false,
  );
  const isOnline = useRef(navigator.onLine);
  const isSyncApplyingRef = useRef(false);

  useEffect(() => {
    const onOnline = () => {
      isOnline.current = true;
      const code = localStorage.getItem(SHOP_CODE_KEY);
      if (code) {
        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => { void pushToServerRef.current(code); }, 300);
      }
    };
    const onOffline = () => {
      isOnline.current = false;
      setSyncStatus("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const pullFromServer = useCallback(async (code: string) => {
    if (!isOnline.current) {
      setSyncStatus("offline");
      return;
    }

    try {
      setSyncStatus("syncing");
      const data = await apiGetData(code);
      const serverSnapshot: Snapshot = {
        records: data.records ?? [],
        customers: data.customers ?? [],
        transactions: data.transactions ?? [],
        settings: data.settings ?? {},
      };

      const lastAt = localStorage.getItem(LAST_SERVER_AT_KEY);
      const baseline = getLastServerSnapshot();
      const local = getLocalSnapshot();

      if (lastAt && lastAt === data.updatedAt && snapshotEquals(local, baseline)) {
        setSyncStatus("synced");
        return;
      }

      // Never blindly overwrite unsynced local changes. Push them through the
      // server's three-way merge first; that merge carries deletions too.
      if (lastAt && !snapshotEquals(local, baseline)) {
        await pushToServerRef.current(code);
        return;
      }

      // First load after joining an existing shop: server is authoritative.
      isSyncApplyingRef.current = true;
      saveSnapshot(serverSnapshot);
      saveLastServerSnapshot(serverSnapshot);
      isSyncApplyingRef.current = false;

      const timeStr = markSynced(data.updatedAt);
      setLastSyncTime(timeStr);
      setSyncStatus("synced");
    } catch {
      isSyncApplyingRef.current = false;
      setSyncStatus("error");
    }
  }, []);

  const pushToServer = useCallback(async (code: string): Promise<boolean> => {
    if (pushInFlightRef.current) return pushInFlightRef.current;

    const promise = (async () => {
      if (!isOnline.current) {
        setSyncStatus("offline");
        return false;
      }

      try {
        setSyncStatus("syncing");

        const rawSnapshot = getLocalSnapshot();
        const localSnapshot = reconcileKhataSnapshot(rawSnapshot);
        if (!snapshotEquals(rawSnapshot, localSnapshot)) {
          isSyncApplyingRef.current = true;
          saveSnapshot(localSnapshot);
          isSyncApplyingRef.current = false;
        }

        // CRITICAL: send the last known server snapshot as `base`.
        // Without this, the server cannot tell a deletion from an old device.
        const base = getLastServerSnapshot();
        const beforePush = getLocalSnapshot();
        const result = await apiPushData(code, localSnapshot, base);
        const mergedSnapshot: Snapshot = {
          records: result.records ?? [],
          customers: result.customers ?? [],
          transactions: result.transactions ?? [],
          settings: result.settings ?? {},
        };

        const afterPush = getLocalSnapshot();
        const changedDuringPush = !snapshotEquals(afterPush, beforePush);

        if (!changedDuringPush) {
          saveLastServerSnapshot(mergedSnapshot);
          isSyncApplyingRef.current = true;
          saveSnapshot(mergedSnapshot);
          isSyncApplyingRef.current = false;

          const timeStr = markSynced(result.updatedAt);
          setLastSyncTime(timeStr);
          setSyncStatus("synced");
        } else {
          // A user changed data while the request was in flight. Keep the
          // previous baseline so the next three-way merge can preserve both
          // the server's just-merged changes and the new local change.
          setSyncStatus("syncing");
          if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
          pushTimerRef.current = setTimeout(() => { void pushToServerRef.current(code); }, 300);
        }

        return true;
      } catch {
        isSyncApplyingRef.current = false;
        setSyncStatus("error");
        return false;
      }
    })();

    pushInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      if (pushInFlightRef.current === promise) pushInFlightRef.current = null;
    }
  }, []);

  pushToServerRef.current = pushToServer;

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (isSyncApplyingRef.current) return;
      const watchKeys = [LS_RECORDS, LS_CUSTOMERS, LS_TRANSACTIONS, LS_SETTINGS];
      if (!watchKeys.includes(e.key ?? "")) return;
      const code = localStorage.getItem(SHOP_CODE_KEY);
      if (!code) return;

      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => { void pushToServer(code); }, 1500);
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [pushToServer]);

  useEffect(() => {
    const code = localStorage.getItem(SHOP_CODE_KEY);
    if (!code) return;

    const syncExistingShop = async () => {
      // A restored JSON backup should be merged into its shop before any
      // server snapshot is allowed to replace the restored local records.
      if (localStorage.getItem(RESTORE_PENDING_SYNC_KEY) === "1") {
        try {
          await apiJoinShop(code);
          const pushed = await pushToServer(code);
          if (pushed) {
            localStorage.removeItem(RESTORE_PENDING_SYNC_KEY);
            await pullFromServer(code);
          } else {
            setSyncStatus("error");
          }
        } catch {
          setSyncStatus("error");
        }
        return;
      }

      const baselineAt = localStorage.getItem(LAST_SERVER_AT_KEY);
      if (!baselineAt) {
        await pullFromServer(code);
      } else {
        const pushed = await pushToServer(code);
        if (pushed) await pullFromServer(code);
      }
    };

    void syncExistingShop();
    const interval = setInterval(() => { void pullFromServer(code); }, 30000);
    return () => clearInterval(interval);
  }, [shopCode, pullFromServer, pushToServer]);

  const setupShop = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase().slice(0, 8);
    if (trimmed.length < 4) {
      return { success: false, isNew: false, error: "Code 4 se 8 letters ka hona chahiye" };
    }

    let result: Awaited<ReturnType<typeof apiJoinShop>>;
    try {
      result = await apiJoinShop(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error";
      return { success: false, isNew: false, error: message };
    }
    if (!result) {
      return { success: false, isNew: false, error: "Server se connection nahi ho pa raha. Internet check karein." };
    }

    localStorage.setItem(SHOP_CODE_KEY, trimmed);
    setShopCode(trimmed);

    if (!result.isNew) {
      localStorage.removeItem(LAST_SERVER_AT_KEY);
      localStorage.removeItem(LAST_SERVER_SNAPSHOT_KEY);
      await pullFromServer(trimmed);
    } else {
      const emptyBase: Snapshot = { records: [], customers: [], transactions: [], settings: {} };
      saveLastServerSnapshot(emptyBase);
      localStorage.removeItem(LAST_SERVER_AT_KEY);
      const pushed = await pushToServer(trimmed);
      if (!pushed) {
        return { success: false, isNew: true, error: "Shop ban gaya, lekin data server par nahi pahucha. Abhi Sync dobara karein." };
      }
    }

    return { success: true, isNew: result.isNew };
  }, [pullFromServer, pushToServer]);

  const syncNow = useCallback(async () => {
    const code = localStorage.getItem(SHOP_CODE_KEY);
    if (!code) return;
    const pushed = await pushToServer(code);
    if (pushed) await pullFromServer(code);
  }, [pullFromServer, pushToServer]);

  const disconnectShop = useCallback(() => {
    localStorage.removeItem(SHOP_CODE_KEY);
    localStorage.removeItem(LAST_SERVER_AT_KEY);
    localStorage.removeItem(LAST_SERVER_SNAPSHOT_KEY);
    setShopCode("");
    setSyncStatus("not-setup");
  }, []);

  return {
    shopCode, syncStatus, lastSyncTime,
    apiServerUrl, saveApiServerUrl, testApiConnection,
    setupShop, syncNow, disconnectShop,
  };
}
