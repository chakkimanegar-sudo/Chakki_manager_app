import { useState, useEffect } from "react";
import { KhataCustomer, KhataTransaction } from "@/lib/types";

const CUSTOMERS_KEY = "khata_customers";
const TRANSACTIONS_KEY = "khata_transactions";

export type KhataTransactionWithPhoto = KhataTransaction & {
  photo?: string;
};

type TransactionInput = Omit<KhataTransaction, "id" | "createdAt"> & {
  photo?: string;
};

type TransactionUpdates = Partial<
  Omit<KhataTransaction, "id" | "customerId" | "createdAt">
> & {
  photo?: string;
};

function normalizeMobile(m: string) {
  return (m ?? "").replace(/\D/g, "");
}

function normalizeName(n: string) {
  return (n ?? "")
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function readCustomers(): KhataCustomer[] {
  try {
    const s = localStorage.getItem(CUSTOMERS_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function readTransactions(): KhataTransactionWithPhoto[] {
  try {
    const s = localStorage.getItem(TRANSACTIONS_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function writeCustomers(list: KhataCustomer[]) {
  const json = JSON.stringify(list);
  localStorage.setItem(CUSTOMERS_KEY, json);
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: CUSTOMERS_KEY,
      newValue: json,
    })
  );
}

function writeTransactions(list: KhataTransactionWithPhoto[]) {
  const json = JSON.stringify(list);
  localStorage.setItem(TRANSACTIONS_KEY, json);
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: TRANSACTIONS_KEY,
      newValue: json,
    })
  );
}

export function useKhata() {
  const [customers, setCustomers] = useState<KhataCustomer[]>([]);
  const [transactions, setTransactions] = useState<KhataTransactionWithPhoto[]>(
    []
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setCustomers(readCustomers());
    setTransactions(readTransactions());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CUSTOMERS_KEY) {
        try {
          setCustomers(e.newValue ? JSON.parse(e.newValue) : []);
        } catch (_) {}
      }

      if (e.key === TRANSACTIONS_KEY) {
        try {
          setTransactions(e.newValue ? JSON.parse(e.newValue) : []);
        } catch (_) {}
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const syncState = () => {
    setCustomers(readCustomers());
    setTransactions(readTransactions());
  };

  const findOrCreateCustomer = (
    name: string,
    mobile: string,
    village?: string
  ): { customer: KhataCustomer; isNew: boolean } => {
    const fresh = readCustomers();
    const mob = normalizeMobile(mobile);
    const nm = normalizeName(name);

    if (mob) {
      const byMobile = fresh.find(
        (c) => normalizeMobile(c.mobile) === mob
      );

      if (byMobile) {
        syncState();
        return { customer: byMobile, isNew: false };
      }
    }

    const byName = fresh.find((c) => normalizeName(c.name) === nm);

    if (byName) {
      syncState();
      return { customer: byName, isNew: false };
    }

    const newC: KhataCustomer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      mobile: mob,
      village: village?.trim() || "",
      createdAt: Date.now(),
    };

    const updated = [...fresh, newC];

    writeCustomers(updated);
    setCustomers(updated);

    return { customer: newC, isNew: true };
  };

  const findExistingCustomer = (
    name: string,
    mobile: string
  ): KhataCustomer | undefined => {
    const fresh = readCustomers();
    const mob = normalizeMobile(mobile);

    if (mob) {
      const byMobile = fresh.find(
        (c) => normalizeMobile(c.mobile) === mob
      );

      if (byMobile) return byMobile;
    }

    const nm = normalizeName(name);

    return fresh.find((c) => normalizeName(c.name) === nm);
  };

  const addCustomer = (
    name: string,
    mobile: string,
    village?: string
  ): KhataCustomer => {
    const fresh = readCustomers();
    const mob = normalizeMobile(mobile);

    if (mob) {
      const existing = fresh.find(
        (c) => normalizeMobile(c.mobile) === mob
      );

      if (existing) {
        syncState();
        return existing;
      }
    }

    const byName = fresh.find(
      (c) => normalizeName(c.name) === normalizeName(name)
    );

    if (byName) {
      syncState();
      return byName;
    }

    const newC: KhataCustomer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      mobile: mob,
      village: village?.trim() || "",
      createdAt: Date.now(),
    };

    const updated = [...fresh, newC];

    writeCustomers(updated);
    setCustomers(updated);

    return newC;
  };

  const updateCustomer = (
    id: string,
    updates: Partial<KhataCustomer>
  ) => {
    const fresh = readCustomers();

    const updated = fresh.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );

    writeCustomers(updated);
    setCustomers(updated);
  };

  const deleteCustomer = (id: string): boolean => {
    const freshCustomers = readCustomers();
    const freshTransactions = readTransactions();

    // Never delete accounting history just because the customer entry is
    // removed. A customer with transactions must remain in the ledger.
    if (freshTransactions.some((t) => t.customerId === id)) {
      return false;
    }

    const updatedC = freshCustomers.filter((c) => c.id !== id);
    writeCustomers(updatedC);
    setCustomers(updatedC);
    return true;
  };

  /**
   * Add Khata transaction.
   *
   * `photo` is optional and contains the compressed image data.
   */
  const addTransaction = (
    tx: TransactionInput
  ): KhataTransactionWithPhoto => {
    if (!tx.amount || tx.amount <= 0) {
      throw new Error("Amount must be > 0");
    }

    const fresh = readTransactions();

    const newTx: KhataTransactionWithPhoto = {
      ...tx,
      id: crypto.randomUUID(),
      notes: tx.notes ?? "",
      photo: tx.photo || undefined,
      createdAt: Date.now(),
    };

    const updated = [...fresh, newTx];

    writeTransactions(updated);
    setTransactions(updated);

    return newTx;
  };

  /**
   * Update Khata transaction.
   *
   * `photo` can be added, replaced or removed.
   */
  const updateTransaction = (
    id: string,
    updates: TransactionUpdates
  ) => {
    const fresh = readTransactions();

    const updated = fresh.map((t) => {
      if (t.id !== id) return t;

      const merged: KhataTransactionWithPhoto = {
        ...t,
        ...updates,
      };

      // Recalculate amount if kg/rate changed and both exist.
      if (
        (updates.kg !== undefined || updates.rate !== undefined) &&
        merged.kg &&
        merged.rate
      ) {
        merged.amount =
          Math.round(merged.kg * merged.rate * 100) / 100;
      }

      // Empty photo means remove the photo.
      if (updates.photo === "") {
        delete merged.photo;
      }

      return merged;
    });

    writeTransactions(updated);
    setTransactions(updated);
  };

  const deleteTransaction = (id: string): boolean => {
    const fresh = readTransactions();
    const target = fresh.find((t) => t.id === id);

    // Billing Udhar transactions are derived from the billing record.
    // Deleting them independently would cause reconciliation to recreate
    // them on the next sync. Delete the billing record from Records instead.
    if (target?.recordId) {
      return false;
    }

    const updated = fresh.filter((t) => t.id !== id);
    writeTransactions(updated);
    setTransactions(updated);
    return true;
  };

  const findTransactionByRecordId = (
    recordId: string
  ): KhataTransactionWithPhoto | undefined => {
    return readTransactions().find(
      (t) => t.recordId === recordId
    );
  };

  const deleteTransactionByRecordId = (recordId: string) => {
    const fresh = readTransactions();
    const updated = fresh.filter((t) => t.recordId !== recordId);

    if (updated.length !== fresh.length) {
      writeTransactions(updated);
      setTransactions(updated);
    }
  };

  /** Positive balance = customer owes us. */
  const getBalance = (customerId: string): number => {
    const balance = readTransactions()
      .filter((t) => t.customerId === customerId)
      .reduce(
        (sum, t) =>
          t.type === "udhar"
            ? sum + t.amount
            : sum - t.amount,
        0
      );

    return Math.round(balance * 100) / 100;
  };

  const getCustomerSummary = (customerId: string) => {
    const txs = readTransactions().filter(
      (t) => t.customerId === customerId
    );

    const udharTxs = txs.filter(
      (t) => t.type === "udhar"
    );

    const paymentTxs = txs.filter(
      (t) => t.type === "payment"
    );

    const totalKg =
      Math.round(
        udharTxs.reduce(
          (s, t) => s + (t.kg ?? 0),
          0
        ) * 100
      ) / 100;

    const totalAmount =
      Math.round(
        udharTxs.reduce(
          (s, t) => s + t.amount,
          0
        ) * 100
      ) / 100;

    const totalPaid =
      Math.round(
        paymentTxs.reduce(
          (s, t) => s + t.amount,
          0
        ) * 100
      ) / 100;

    const balance =
      Math.round(
        (totalAmount - totalPaid) * 100
      ) / 100;

    return {
      totalKg,
      totalAmount,
      totalPaid,
      balance,
      txCount: txs.length,
    };
  };

  const getCustomerTransactions = (
    customerId: string
  ): KhataTransactionWithPhoto[] =>
    readTransactions()
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => {
        const d =
          new Date(b.date).getTime() -
          new Date(a.date).getTime();

        return d !== 0
          ? d
          : b.createdAt - a.createdAt;
      });

  return {
    customers,
    transactions,
    isLoaded,
    findOrCreateCustomer,
    findExistingCustomer,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    findTransactionByRecordId,
    deleteTransactionByRecordId,
    getBalance,
    getCustomerSummary,
    getCustomerTransactions,
  };
}