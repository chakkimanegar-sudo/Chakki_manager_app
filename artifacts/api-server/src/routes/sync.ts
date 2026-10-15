import { Router } from "express";
import { db, shopsTable, shopDataTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const syncRouter = Router();

type Item = Record<string, any>;

function asArray(value: unknown): Item[] {
  return Array.isArray(value) ? value.filter((x) => x && typeof x === "object") as Item[] : [];
}

function getId(item: Item): string | null {
  return typeof item.id === "string" ? item.id : null;
}

/**
 * Three-way merge:
 *
 * base   = last snapshot known by this phone
 * client = current snapshot on this phone
 * server = current snapshot in database
 *
 * This allows an actual deletion to propagate.
 */
function mergeEntityArrays(
  baseValue: unknown,
  clientValue: unknown,
  serverValue: unknown,
): Item[] {
  const base = asArray(baseValue);
  const client = asArray(clientValue);
  const server = asArray(serverValue);

  const baseMap = new Map<string, Item>();
  const clientMap = new Map<string, Item>();
  const serverMap = new Map<string, Item>();

  for (const item of base) {
    const id = getId(item);
    if (id) baseMap.set(id, item);
  }

  for (const item of client) {
    const id = getId(item);
    if (id) clientMap.set(id, item);
  }

  for (const item of server) {
    const id = getId(item);
    if (id) serverMap.set(id, item);
  }

  const ids = new Set([
    ...baseMap.keys(),
    ...clientMap.keys(),
    ...serverMap.keys(),
  ]);

  const result: Item[] = [];

  for (const id of ids) {
    const baseItem = baseMap.get(id);
    const clientItem = clientMap.get(id);
    const serverItem = serverMap.get(id);

    const clientExists = clientMap.has(id);
    const serverExists = serverMap.has(id);
    const baseExists = baseMap.has(id);

    // Brand-new item created only on client.
    if (!baseExists && clientExists && !serverExists) {
      result.push(clientItem!);
      continue;
    }

    // Brand-new item created only on server.
    if (!baseExists && !clientExists && serverExists) {
      result.push(serverItem!);
      continue;
    }

    // Item exists only on one side and did not exist in base.
    if (!baseExists) {
      if (clientExists) result.push(clientItem!);
      else if (serverExists) result.push(serverItem!);
      continue;
    }

    const clientChanged =
      JSON.stringify(clientItem ?? null) !== JSON.stringify(baseItem ?? null);

    const serverChanged =
      JSON.stringify(serverItem ?? null) !== JSON.stringify(baseItem ?? null);

    // Client changed, server did not.
    // This includes CLIENT DELETION.
    if (clientChanged && !serverChanged) {
      if (clientExists) {
        result.push(clientItem!);
      }
      // If client does not exist, intentionally omit it = deletion.
      continue;
    }

    // Server changed, client did not.
    if (!clientChanged && serverChanged) {
      if (serverExists) {
        result.push(serverItem!);
      }
      continue;
    }

    // Neither changed.
    if (!clientChanged && !serverChanged) {
      if (serverExists) {
        result.push(serverItem!);
      } else if (clientExists) {
        result.push(clientItem!);
      }
      continue;
    }

    // BOTH changed.
    // Server wins to prevent one stale phone overwriting
    // another phone's newer change.
    if (serverExists) {
      result.push(serverItem!);
    } else if (clientExists) {
      result.push(clientItem!);
    }
  }

  return result;
}

function mergeSettings(
  baseValue: unknown,
  clientValue: unknown,
  serverValue: unknown,
): Record<string, number> {
  const base =
    baseValue && typeof baseValue === "object"
      ? (baseValue as Record<string, number>)
      : {};

  const client =
    clientValue && typeof clientValue === "object"
      ? (clientValue as Record<string, number>)
      : {};

  const server =
    serverValue && typeof serverValue === "object"
      ? (serverValue as Record<string, number>)
      : {};

  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(client),
    ...Object.keys(server),
  ]);

  const result: Record<string, number> = {};

  for (const key of keys) {
    const baseValueForKey = base[key];
    const clientHas = Object.prototype.hasOwnProperty.call(client, key);
    const serverHas = Object.prototype.hasOwnProperty.call(server, key);

    const clientValueForKey = client[key];
    const serverValueForKey = server[key];

    const clientChanged =
      clientHas !== Object.prototype.hasOwnProperty.call(base, key) ||
      clientValueForKey !== baseValueForKey;

    const serverChanged =
      serverHas !== Object.prototype.hasOwnProperty.call(base, key) ||
      serverValueForKey !== baseValueForKey;

    if (clientChanged && !serverChanged) {
      if (clientHas && typeof clientValueForKey === "number") {
        result[key] = clientValueForKey;
      }
    } else if (!clientChanged && serverChanged) {
      if (serverHas && typeof serverValueForKey === "number") {
        result[key] = serverValueForKey;
      }
    } else if (!clientChanged && !serverChanged) {
      if (serverHas && typeof serverValueForKey === "number") {
        result[key] = serverValueForKey;
      }
    } else {
      // Both changed — server authoritative.
      if (serverHas && typeof serverValueForKey === "number") {
        result[key] = serverValueForKey;
      }
    }
  }

  return result;
}

function removeOrphanTransactions(
  records: Item[],
  customers: Item[],
  transactions: Item[],
): Item[] {
  const recordIds = new Set(
    records.map(getId).filter((id): id is string => Boolean(id)),
  );

  const customerIds = new Set(
    customers.map(getId).filter((id): id is string => Boolean(id)),
  );

  const result: Item[] = [];
  const linkedRecordIndexes = new Map<string, number>();

  for (const transaction of transactions) {
    const recordId =
      typeof transaction.recordId === "string"
        ? transaction.recordId
        : null;

    const customerId =
      typeof transaction.customerId === "string"
        ? transaction.customerId
        : null;

    // A transaction linked to a record must point to an existing record.
    if (recordId && !recordIds.has(recordId)) continue;

    // A transaction linked to a customer must point to an existing customer.
    if (customerId && !customerIds.has(customerId)) continue;

    // A billing record should have exactly one derived Udhar transaction.
    // Older versions could leave duplicates behind; keep the latest occurrence.
    if (recordId) {
      const previousIndex = linkedRecordIndexes.get(recordId);
      if (previousIndex !== undefined) {
        result[previousIndex] = transaction;
        continue;
      }
      linkedRecordIndexes.set(recordId, result.length);
    }

    result.push(transaction);
  }

  return result;
}

// POST /api/shop — create or join a shop by code
syncRouter.post("/shop", async (req, res) => {
  const { code, name } = req.body as {
    code?: string;
    name?: string;
  };

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const normalized = code.trim().toUpperCase().slice(0, 8);

  if (normalized.length < 4) {
    res.status(400).json({
      error: "code must be at least 4 characters",
    });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.code, normalized))
      .limit(1);

    if (existing.length > 0) {
      const shop = existing[0];

      res.json({
        id: shop.id,
        code: shop.code,
        name: shop.name,
        isNew: false,
      });

      return;
    }

    const [shop] = await db
      .insert(shopsTable)
      .values({
        code: normalized,
        name: name?.trim() || "Meri Chakki",
      })
      .returning();

    await db.insert(shopDataTable).values({
      shopId: shop.id,
    });

    res.json({
      id: shop.id,
      code: shop.code,
      name: shop.name,
      isNew: true,
    });
  } catch (err) {
    req.log.error({ err }, "Error in POST /shop");
    res.status(500).json({
      error: "Server error",
    });
  }
});

// GET /api/shop/:code/data — get full snapshot
syncRouter.get("/shop/:code/data", async (req, res) => {
  const code = req.params.code.toUpperCase();

  try {
    const shops = await db
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.code, code))
      .limit(1);

    if (!shops.length) {
      res.status(404).json({
        error: "Shop not found",
      });

      return;
    }

    const shopId = shops[0].id;

    const dataRows = await db
      .select()
      .from(shopDataTable)
      .where(eq(shopDataTable.shopId, shopId))
      .limit(1);

    if (!dataRows.length) {
      res.json({
        shopId,
        records: [],
        customers: [],
        transactions: [],
        settings: {},
        updatedAt: new Date().toISOString(),
      });

      return;
    }

    const d = dataRows[0];

    res.json({
      shopId,
      records: d.records ?? [],
      customers: d.customers ?? [],
      transactions: d.transactions ?? [],
      settings: d.settings ?? {},
      updatedAt: (d.updatedAt as Date).toISOString(),
    });
  } catch (err) {
    req.log.error(
      { err },
      "Error in GET /shop/:code/data",
    );

    res.status(500).json({
      error: "Server error",
    });
  }
});

// PUT /api/shop/:code/data — safe three-way merge
syncRouter.put("/shop/:code/data", async (req, res) => {
  const code = req.params.code.toUpperCase();

  const body = req.body as {
    records?: unknown;
    customers?: unknown;
    transactions?: unknown;
    settings?: unknown;
    base?: {
      records?: unknown;
      customers?: unknown;
      transactions?: unknown;
      settings?: unknown;
    };
  };

  const records = asArray(body.records);
  const customers = asArray(body.customers);
  const transactions = asArray(body.transactions);

  const settings =
    body.settings &&
    typeof body.settings === "object"
      ? (body.settings as Record<string, number>)
      : {};

  const base = body.base ?? {
    records: [],
    customers: [],
    transactions: [],
    settings: {},
  };

  if (
    !Array.isArray(body.records) ||
    !Array.isArray(body.customers) ||
    !Array.isArray(body.transactions)
  ) {
    res.status(400).json({
      error:
        "Invalid payload — records, customers, transactions must be arrays",
    });

    return;
  }

  try {
    const shops = await db
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.code, code))
      .limit(1);

    if (!shops.length) {
      res.status(404).json({
        error: "Shop not found",
      });

      return;
    }

    const shopId = shops[0].id;

    /*
     * IMPORTANT:
     * Use a DB transaction + row lock.
     *
     * Without the lock, two phones can read the same old server
     * snapshot at the same time and then overwrite each other's
     * merged result.
     */
    const result = await db.transaction(async (tx) => {
      await tx
        .insert(shopDataTable)
        .values({
          shopId,
          records: [],
          customers: [],
          transactions: [],
          settings: {},
        })
        .onConflictDoNothing({
          target: shopDataTable.shopId,
        });

      const existing = await tx
        .select()
        .from(shopDataTable)
        .where(eq(shopDataTable.shopId, shopId))
        .limit(1)
        .for("update");

      const current = existing[0];

      // Never let an older client (which does not send `base`) overwrite
      // an existing shop snapshot. It must refresh to the fixed client first.
      if (body.base === undefined) {
        const serverHasData =
          asArray(current?.records).length > 0 ||
          asArray(current?.customers).length > 0 ||
          asArray(current?.transactions).length > 0 ||
          Object.keys(
            current?.settings && typeof current.settings === "object"
              ? (current.settings as Record<string, number>)
              : {},
          ).length > 0;

        if (serverHasData) {
          const error = new Error("CLIENT_UPDATE_REQUIRED");
          (error as Error & { status?: number }).status = 409;
          throw error;
        }
      }

      const serverRecords = asArray(current?.records);
      const serverCustomers = asArray(current?.customers);
      const serverTransactions = asArray(current?.transactions);
      const serverSettings =
        current?.settings &&
        typeof current.settings === "object"
          ? (current.settings as Record<string, number>)
          : {};

      let mergedRecords = mergeEntityArrays(
        base.records,
        records,
        serverRecords,
      );

      let mergedCustomers = mergeEntityArrays(
        base.customers,
        customers,
        serverCustomers,
      );

      let mergedTransactions = mergeEntityArrays(
        base.transactions,
        transactions,
        serverTransactions,
      );

      const mergedSettings = mergeSettings(
        base.settings,
        settings,
        serverSettings,
      );

      /*
       * Remove ghost Khata transactions.
       *
       * If a billing record/customer was deleted, its linked
       * transaction must not survive on the server.
       */
      mergedTransactions = removeOrphanTransactions(
        mergedRecords,
        mergedCustomers,
        mergedTransactions,
      );

      const now = new Date();

      await tx
        .update(shopDataTable)
        .set({
          records: mergedRecords,
          customers: mergedCustomers,
          transactions: mergedTransactions,
          settings: mergedSettings,
          updatedAt: now,
        })
        .where(eq(shopDataTable.shopId, shopId));

      return {
        shopId,
        records: mergedRecords,
        customers: mergedCustomers,
        transactions: mergedTransactions,
        settings: mergedSettings,
        updatedAt: now.toISOString(),
      };
    });

    // IMPORTANT:
    // Return the COMPLETE merged snapshot.
    // The old API returned only shopId + updatedAt,
    // which could make the client apply an incomplete snapshot.
    res.json(result);
  } catch (err) {
    if ((err as { status?: number })?.status === 409) {
      res.status(409).json({
        error: "Client update required — please refresh this app before syncing.",
      });
      return;
    }

    req.log.error(
      { err },
      "Error in PUT /shop/:code/data",
    );

    res.status(500).json({
      error: "Server error",
    });
  }
});

export default syncRouter;