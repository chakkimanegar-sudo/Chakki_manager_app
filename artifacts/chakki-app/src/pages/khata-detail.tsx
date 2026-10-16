import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useKhata } from "@/hooks/use-khata";
import { useSettings } from "@/hooks/use-settings";
import { KhataTransaction } from "@/lib/types";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Minus, Trash2, Pencil, Phone, Banknote, BookOpen, MapPin, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ANAJ_OPTIONS = ["Gehu", "Makka", "Dal", "Besan", "Wata", "Bajra", "Jowar", "Chawal", "Anya"];
const ANAJ_HINDI: Record<string, string> = {
  Gehu: "गेहूं", Makka: "मक्का", Dal: "दाल", Besan: "बेसन",
  Wata: "वाटा", Bajra: "बाजरा", Jowar: "ज्वार", Chawal: "चावल", Anya: "अन्य",
};

type Mode = "none" | "udhar" | "payment";

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.112 1.523 5.836L.057 23.286a.75.75 0 0 0 .918.93l5.618-1.474A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.884 0-3.65-.52-5.16-1.427l-.37-.22-3.835 1.006 1.02-3.727-.242-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
);

/** Inline edit form for a single transaction */
function EditTransactionForm({
  tx,
  rates,
  onSave,
  onCancel,
}: {
  tx: KhataTransaction;
  rates: Record<string, number>;
  onSave: (updates: Partial<Omit<KhataTransaction, "id" | "customerId" | "createdAt">>) => void;
  onCancel: () => void;
}) {
  const [editAnaj, setEditAnaj] = useState(tx.anaj ?? "Gehu");
  const [editKg, setEditKg] = useState(tx.kg ? String(tx.kg) : "");
  const [editRate, setEditRate] = useState(tx.rate ? String(Math.round(tx.rate)) : String(Math.round(rates[tx.anaj ?? "Gehu"] ?? 2)));
  const [editAmount, setEditAmount] = useState(String(tx.amount));
  const [editDate, setEditDate] = useState(tx.date);
  const [editNotes, setEditNotes] = useState(tx.notes ?? "");
  const [useKgMode, setUseKgMode] = useState(tx.type === "udhar" && !!tx.kg);

  const kgVal = parseFloat(editKg) || 0;
  const rateVal = parseInt(editRate, 10) || 0;
  const computedAmount = useKgMode && tx.type === "udhar"
    ? Math.round(kgVal * rateVal * 100) / 100
    : parseFloat(editAmount) || 0;
  const finalAmount = computedAmount;

  const handleAnajChange = (v: string) => {
    setEditAnaj(v);
    setEditRate(String(Math.round(rates[v] ?? 2)));
  };

  const handleSave = () => {
    if (finalAmount <= 0) return;
    if (tx.type === "udhar" && useKgMode) {
      onSave({
        amount: finalAmount,
        anaj: editAnaj,
        kg: kgVal,
        rate: rateVal,
        date: editDate,
        notes: editNotes.trim(),
      });
    } else {
      onSave({
        amount: finalAmount,
        date: editDate,
        notes: editNotes.trim(),
      });
    }
  };

  return (
    <div className="space-y-3 pt-2 border-t border-border/50 mt-2">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Edit Transaction</p>

      {tx.type === "udhar" && (
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setUseKgMode(true)}
            className={`flex-1 py-1.5 rounded-lg font-semibold border transition-all ${useKgMode ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"}`}
          >KG se</button>
          <button
            onClick={() => setUseKgMode(false)}
            className={`flex-1 py-1.5 rounded-lg font-semibold border transition-all ${!useKgMode ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"}`}
          >Direct</button>
        </div>
      )}

      {tx.type === "udhar" && useKgMode ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
              <Select value={editAnaj} onValueChange={handleAnajChange}>
                <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANAJ_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{a}{ANAJ_HINDI[a] ? ` — ${ANAJ_HINDI[a]}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">KG</Label>
              <Input type="number" step="0.5" min="0.5" inputMode="decimal" value={editKg} onChange={(e) => setEditKg(e.target.value)} className="h-10 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Rate ₹/KG</Label>
              <Input type="number" step="1" min="1" inputMode="numeric" value={editRate} onChange={(e) => setEditRate(e.target.value)} className="h-10 text-sm" />
            </div>
            <div className="flex items-end pb-0.5">
              <div className="bg-primary/10 rounded-lg p-2 text-center w-full">
                <p className="text-[9px] text-muted-foreground">Total</p>
                <p className="text-sm font-bold text-primary">₹{finalAmount.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div>
          <Label className="text-xs">Amount ₹</Label>
          <Input type="number" step="1" min="1" inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="h-10 text-sm" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tarikh</Label>
          <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-10 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Input placeholder="Optional..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="h-10 text-sm" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={finalAmount <= 0} className="flex-1 h-9 text-sm rounded-xl gap-1.5">
          <Check className="w-3.5 h-3.5" /> Save
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1 h-9 text-sm rounded-xl gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export default function KhataDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const {
    customers, isLoaded, addTransaction, updateTransaction, deleteTransaction,
    getBalance, getCustomerTransactions,
  } = useKhata();
  const { rates } = useSettings();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("none");
  const [anaj, setAnaj] = useState("Gehu");
  const [kg, setKg] = useState("");
  const [manualRate, setManualRate] = useState(String(Math.round(rates["Gehu"] ?? 2)));
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [useKgMode, setUseKgMode] = useState(true);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [rateError, setRateError] = useState("");

  const customer = customers.find((c) => c.id === id);

  useEffect(() => {
    if (isLoaded && !customer) {
      setLocation("/khata");
    }
  }, [isLoaded, customer, setLocation]);

  if (!isLoaded || !customer) return null;

  const balance = getBalance(id!);
  const txList = getCustomerTransactions(id!);

  // Rate is integer
  const activeRate = parseInt(manualRate, 10) || Math.round(rates[anaj]) || 0;
  const kgVal = parseFloat(kg) || 0;
  const computedFromKg = Math.round(kgVal * activeRate * 100) / 100;
  const finalAmount = mode === "udhar" && useKgMode ? computedFromKg : parseFloat(amount) || 0;

  const handleAnajChange = (v: string) => {
    setAnaj(v);
    setManualRate(String(Math.round(rates[v] ?? 2)));
  };

  const handleRateChange = (v: string) => {
    setManualRate(v);
    const num = parseFloat(v);
    setRateError(v !== "" && (!Number.isInteger(num) || num <= 0) ? "Sirf poora number — jaise 2, 3, 5" : "");
  };

  const handleSave = () => {
    if (!finalAmount || finalAmount <= 0) {
      toast({ title: "Rakam sahi darj karein — 0 se zyada hona chahiye", variant: "destructive" }); return;
    }
    if (mode === "udhar" && useKgMode) {
      if (kgVal <= 0) {
        toast({ title: "Wajan sahi darj karein", variant: "destructive" }); return;
      }
      if (activeRate <= 0 || !Number.isInteger(activeRate)) {
        toast({ title: "Rate sirf poora number hona chahiye — jaise 2, 3, 5", variant: "destructive" }); return;
      }
    }

    if (mode === "udhar") {
      addTransaction({
        customerId: id!,
        type: "udhar",
        amount: finalAmount,
        anaj: useKgMode ? anaj : undefined,
        kg: useKgMode ? kgVal : undefined,
        rate: useKgMode ? activeRate : undefined,
        date,
        notes: notes.trim(),
      });
      toast({ title: `📒 Udhar add hua: ₹${finalAmount.toLocaleString("en-IN")}` });
    } else {
      if (finalAmount > balance && balance > 0) {
        if (!confirm(`Payment ₹${finalAmount.toLocaleString("en-IN")} baaki udhar ₹${balance.toLocaleString("en-IN")} se zyada hai. Phir bhi add karein?`)) return;
      }
      addTransaction({
        customerId: id!,
        type: "payment",
        amount: finalAmount,
        date,
        notes: notes.trim(),
      });
      toast({ title: `✅ Payment add hua: ₹${finalAmount.toLocaleString("en-IN")}` });
    }

    setMode("none");
    setKg(""); setAmount(""); setNotes(""); setRateError("");
  };

  const handleFullPayment = () => {
    if (balance <= 0) return;
    const amountToSettle = Math.round(balance * 100) / 100;
    if (!confirm(`${customer.name} se poora baaki ₹${amountToSettle.toLocaleString("en-IN")} mil gaya? Isse ek payment entry banegi aur purana udhar history mein rahega.`)) {
      return;
    }

    addTransaction({
      customerId: id!,
      type: "payment",
      amount: amountToSettle,
      date: format(new Date(), "yyyy-MM-dd"),
      notes: "Pura baaki payment",
    });
    toast({ title: `✅ Pura payment darj hua: ₹${amountToSettle.toLocaleString("en-IN")}` });
  };

  const handleDelete = (txId: string) => {
    if (confirm("Is transaction ko delete karein?")) {
      const deleted = deleteTransaction(txId);
      if (deleted) {
        toast({ title: "Transaction delete ho gaya" });
      } else {
        toast({ title: "Ye transaction billing entry se linked hai — Records se bill delete karein", variant: "destructive" });
      }
    }
  };

  const handleEditSave = (txId: string, updates: Parameters<typeof updateTransaction>[1]) => {
    updateTransaction(txId, updates);
    setEditingTxId(null);
    toast({ title: "✅ Transaction update ho gaya" });
  };

  const sendWhatsAppStatement = () => {
    if (!customer.mobile) {
      toast({ title: "Mobile number nahi hai", variant: "destructive" }); return;
    }
    const lines = txList.map((t) => {
      if (t.type === "udhar") {
        const detail = t.anaj && t.kg ? `${t.anaj} ${t.kg}KG × ₹${t.rate}` : "Udhar";
        return `• ${t.date}: 📒 ${detail} = ₹${t.amount.toLocaleString("en-IN")}`;
      }
      return `• ${t.date}: ✅ Payment = ₹${t.amount.toLocaleString("en-IN")}`;
    }).join("\n");

    const message =
      `🏭 *Kanha Chakki — Khata Statement*\n\n` +
      `👤 ${customer.name} ji\n` +
      (customer.village ? `🏘️ ${customer.village}\n` : "") +
      `\n📋 Transactions:\n${lines || "Koi transaction nahi"}\n\n` +
      `💰 *Kul Baaki: ₹${balance.toLocaleString("en-IN")}*\n\n` +
      `UPI: 6266506662@ybl\nShukriya! 🙏`;

    const mob = customer.mobile.replace(/\D/g, "");
    window.open(`https://wa.me/91${mob.slice(-10)}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/khata")} className="bg-secondary p-2.5 rounded-xl hover:bg-secondary/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{customer.name}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {customer.mobile && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{customer.mobile}</span>}
            {customer.village && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.village}</span>}
          </div>
        </div>
        {customer.mobile && (
          <button onClick={sendWhatsAppStatement} className="bg-[#25D366]/10 text-[#25D366] p-2.5 rounded-xl hover:bg-[#25D366]/20 transition-colors">
            {WA_ICON}
          </button>
        )}
      </div>

      {/* Balance card */}
      <div className={`p-5 rounded-2xl ${balance > 0 ? "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800/50" : balance < 0 ? "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800/50" : "bg-card border border-border"}`}>
        <p className="text-sm text-muted-foreground mb-1">Kul Baaki / Current Balance</p>
        {balance > 0 ? (
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">₹{balance.toLocaleString("en-IN")} <span className="text-base font-normal">baki hai</span></p>
        ) : balance < 0 ? (
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">₹{Math.abs(balance).toLocaleString("en-IN")} <span className="text-base font-normal">zyada diya</span></p>
        ) : (
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">Saaf ✓ <span className="text-base font-normal">koi baaki nahi</span></p>
        )}
      </div>

      {/* Action buttons */}
      {mode === "none" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("udhar")}
            className="flex items-center justify-center gap-2 h-14 bg-red-50 border-2 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300 rounded-2xl font-bold text-base transition-all hover:brightness-95"
          >
            <Plus className="w-5 h-5" /> Udhar Jodo
          </button>
          <button
            onClick={() => setMode("payment")}
            className="flex items-center justify-center gap-2 h-14 bg-green-50 border-2 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-700 dark:text-green-300 rounded-2xl font-bold text-base transition-all hover:brightness-95"
          >
            <Minus className="w-5 h-5" /> Paisa Mila
          </button>
        </div>
      )}

      {mode === "none" && balance > 0 && (
        <button
          onClick={handleFullPayment}
          className="w-full flex items-center justify-center gap-2 h-12 bg-green-600 text-white rounded-2xl font-bold text-sm transition-all hover:bg-green-700"
        >
          <Check className="w-5 h-5" /> Pura Payment Mila — ₹{balance.toLocaleString("en-IN")}
        </button>
      )}

      {/* Add form */}
      {mode !== "none" && (
        <div className={`rounded-2xl border-2 p-4 space-y-3 animate-in slide-in-from-bottom-2 duration-200 ${mode === "udhar" ? "border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800" : "border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800"}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">{mode === "udhar" ? "📒 Udhar Jodo" : "✅ Paisa Mila"}</h3>
            <button onClick={() => { setMode("none"); setKg(""); setAmount(""); setNotes(""); setRateError(""); }} className="text-muted-foreground hover:text-foreground text-sm">✕ Band</button>
          </div>

          {mode === "udhar" && (
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setUseKgMode(true)}
                className={`flex-1 py-2 rounded-xl font-semibold border transition-all ${useKgMode ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"}`}
              >KG se calculate</button>
              <button
                onClick={() => setUseKgMode(false)}
                className={`flex-1 py-2 rounded-xl font-semibold border transition-all ${!useKgMode ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"}`}
              >Direct amount</button>
            </div>
          )}

          {mode === "udhar" && useKgMode && (
            <>
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Anaj</Label>
                <Select value={anaj} onValueChange={handleAnajChange}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANAJ_OPTIONS.map((a) => (
                      <SelectItem key={a} value={a}>{a}{ANAJ_HINDI[a] ? ` — ${ANAJ_HINDI[a]}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Wajan (KG)</Label>
                  <Input
                    type="number" step="0.5" min="0.5" inputMode="decimal"
                    placeholder="0.0" value={kg}
                    onChange={(e) => setKg(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Rate (₹/KG)</Label>
                  <Input
                    type="number" step="1" min="1" inputMode="numeric"
                    placeholder="2" value={manualRate}
                    onChange={(e) => handleRateChange(e.target.value)}
                    className={`h-12 ${rateError ? "border-destructive" : ""}`}
                  />
                  {rateError && <p className="text-[10px] text-destructive">{rateError}</p>}
                </div>
              </div>
              {computedFromKg > 0 && (
                <div className="bg-card rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">{kg} KG × ₹{activeRate}/KG</p>
                  <p className="text-xl font-bold text-primary">= ₹{computedFromKg.toLocaleString("en-IN")}</p>
                </div>
              )}
            </>
          )}

          {(mode === "payment" || !useKgMode) && (
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Amount (₹)</Label>
              <Input type="number" step="1" min="1" inputMode="numeric" placeholder="₹ rakam" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-base" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Tarikh</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Notes (Optional)</Label>
              <Input placeholder="Koi baat..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-12" />
            </div>
          </div>

          <Button
            onClick={handleSave}
            className={`w-full h-12 rounded-xl font-bold text-base ${mode === "udhar" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}
          >
            {mode === "udhar" ? "📒 Udhar Add Karein" : "✅ Payment Add Karein"}
          </Button>
        </div>
      )}

      {/* Transaction history */}
      <div className="space-y-2 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Transaction History</h3>
          <span className="text-xs text-muted-foreground">{txList.length} total</span>
        </div>

        {txList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Koi transaction nahi hai abhi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {txList.map((tx) => (
              <div
                key={tx.id}
                className={`rounded-2xl border p-3 ${
                  tx.type === "udhar"
                    ? "bg-red-50/40 border-red-200/60 dark:bg-red-950/20 dark:border-red-800/40"
                    : "bg-green-50/40 border-green-200/60 dark:bg-green-950/20 dark:border-green-800/40"
                }`}
              >
                {/* Row 1: type badge + amount + edit + delete */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${tx.type === "payment" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                      {tx.type === "payment" ? <><Banknote className="w-2.5 h-2.5" /> Payment</> : <><BookOpen className="w-2.5 h-2.5" /> Udhar</>}
                    </span>
                    <span className={`text-base font-bold ${tx.type === "payment" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                      {tx.type === "payment" ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingTxId(editingTxId === tx.id ? null : tx.id)}
                      className={`p-1.5 rounded-lg transition-colors ${editingTxId === tx.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!tx.recordId && (
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: grain breakdown (if udhar with kg) */}
                {tx.anaj && tx.kg !== undefined && editingTxId !== tx.id && (
                  <div className="grid grid-cols-4 gap-1 bg-white/60 dark:bg-white/10 rounded-lg p-2 mb-2 text-center">
                    <div><p className="text-[9px] text-muted-foreground uppercase">Anaj</p><p className="text-xs font-bold">{tx.anaj}</p></div>
                    <div><p className="text-[9px] text-muted-foreground uppercase">KG</p><p className="text-xs font-bold">{tx.kg}</p></div>
                    <div><p className="text-[9px] text-muted-foreground uppercase">Rate</p><p className="text-xs font-bold">₹{tx.rate}</p></div>
                    <div><p className="text-[9px] text-muted-foreground uppercase">Total</p><p className="text-xs font-bold">₹{tx.amount.toLocaleString("en-IN")}</p></div>
                  </div>
                )}

                {/* Row 3: date + notes */}
                {editingTxId !== tx.id && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>📅 {format(new Date(tx.date + "T00:00:00"), "dd MMM, yyyy")}</span>
                    {tx.notes ? <span className="italic truncate max-w-[150px]">"{tx.notes}"</span> : null}
                  </div>
                )}

                {/* Inline edit form */}
                {editingTxId === tx.id && (
                  <EditTransactionForm
                    tx={tx}
                    rates={rates}
                    onSave={(updates) => handleEditSave(tx.id, updates)}
                    onCancel={() => setEditingTxId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
