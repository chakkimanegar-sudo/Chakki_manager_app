export type RecordEntry = {
  id: string;
  customerName: string;
  customerNameHindi?: string;
  mobile: string;
  village?: string;
  photo?: string;
  anaj: string;
  kg: number;
  rate: number;
  total: number;
  date: string;
  notes: string;
  paymentType: "cash" | "udhar";
  createdAt: number;
};

export type KhataCustomer = {
  id: string;
  name: string;
  mobile: string;
  village?: string;
  notes?: string;
  createdAt: number;
};

export type KhataTransaction = {
  id: string;
  customerId: string;
  type: "udhar" | "payment";
  amount: number;
  anaj?: string;
  kg?: number;
  rate?: number;
  entryPaymentType?: "cash" | "udhar";
  recordId?: string;
  date: string;
  notes: string;
  createdAt: number;
};

export type RateSettings = {
  Gehu: number;
  Makka: number;
  Dal: number;
  Besan: number;
  Wata: number;
  [key: string]: number;
};