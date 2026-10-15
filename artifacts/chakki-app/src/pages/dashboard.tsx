import { useState } from "react";
import { useRecords } from "@/hooks/use-records";
import { useKhata } from "@/hooks/use-khata";
import { useSync } from "@/hooks/use-sync";
import { format } from "date-fns";
import { RecordCard } from "@/components/RecordCard";
import { Link } from "wouter";
import {
  PlusCircle, Wallet, Scale, ArrowRight, QrCode, X, Copy, Download,
  Users, AlertCircle, RefreshCw, Wifi, WifiOff, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function QRModal({ onClose }: { onClose: () => void }) {
  const handleShare = async () => {
    try {
      const res = await fetch("/upi-qr.jpg");
      const blob = await res.blob();
      const file = new File([blob], "payment-qr.jpg", { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          text: "💳 Payment QR\nUPI ID: 6266506662@ybl\n\nQR scan karke payment karein 🙏",
          files: [file],
        });
        return;
      }
    } catch (_) {}
    window.open(`https://wa.me/?text=${encodeURIComponent("💳 Mera Payment QR\nUPI ID: 6266506662@ybl\n\nQR scan karke payment karein 🙏")}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 animate-in zoom-in-90 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center w-full">
          <h3 className="text-lg font-bold">Mera Payment QR</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="w-full bg-black rounded-2xl flex items-center justify-center p-3 overflow-hidden">
          <img
            src="/upi-qr.jpg"
            alt="Kanha Chakki payment QR code"
            className="w-full max-w-[300px] aspect-square object-contain rounded-xl"
          />
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">UPI ID</p>
          <p className="font-bold text-foreground text-sm mt-0.5">6266506662@ybl</p>
          <p className="text-xs text-muted-foreground mt-1">Bank of Baroda</p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText("6266506662@ybl");
              } catch (_) {}
            }}
            className="flex items-center justify-center gap-2 border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-3 rounded-xl transition-colors"
          >
            <Copy className="w-4 h-4" /> UPI Copy
          </button>
          <a
            href="/upi-qr.jpg"
            download="kanha-chakki-payment-qr.jpg"
            className="flex items-center justify-center gap-2 border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-3 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" /> QR Save
          </a>
        </div>
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5c] active:bg-[#1aad52] text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
        >
          WhatsApp par bhejo
        </button>
      </div>
    </div>
  );
}

function SyncBadge({ status, lastSyncTime, onSync }: { status: string; lastSyncTime: string; onSync: () => void }) {
  const icon =
    status === "syncing" ? <RefreshCw className="w-3 h-3 animate-spin" /> :
    status === "synced" ? <Check className="w-3 h-3" /> :
    status === "offline" ? <WifiOff className="w-3 h-3" /> :
    status === "error" ? <AlertCircle className="w-3 h-3" /> :
    <Wifi className="w-3 h-3" />;

  const label =
    status === "syncing" ? "Sync ho raha hai..." :
    status === "synced" ? `Synced ${lastSyncTime}` :
    status === "offline" ? "Offline" :
    status === "error" ? "Sync error" :
    "Sync";

  const color =
    status === "synced" ? "text-green-700 bg-green-100 border-green-200 dark:text-green-300 dark:bg-green-900/30 dark:border-green-800" :
    status === "offline" ? "text-amber-700 bg-amber-100 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800" :
    status === "error" ? "text-red-700 bg-red-100 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-800" :
    "text-blue-700 bg-blue-100 border-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-800";

  return (
    <button onClick={onSync} className={`flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1.5 rounded-xl transition-colors ${color}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function Dashboard() {
  const { records, isLoaded } = useRecords();
  const { customers, getCustomerSummary } = useKhata();
  const { syncStatus, lastSyncTime, syncNow } = useSync();
  const [showQR, setShowQR] = useState(false);

  if (!isLoaded) return null;

  const today = format(new Date(), "yyyy-MM-dd");
  const currentMonth = format(new Date(), "yyyy-MM");

  const todaysRecords = records.filter((r) => r.date === today);
  const monthRecords = records.filter((r) => r.date.startsWith(currentMonth));

  const todayTotalAmount = todaysRecords.reduce((sum, r) => sum + r.total, 0);
  const todayTotalKg = todaysRecords.reduce((sum, r) => sum + r.kg, 0);
  const todayCash = todaysRecords.filter((r) => r.paymentType === "cash").reduce((s, r) => s + r.total, 0);
  const todayUdhar = todaysRecords.filter((r) => r.paymentType === "udhar").reduce((s, r) => s + r.total, 0);
  const monthlyTotal = monthRecords.reduce((sum, r) => sum + r.total, 0);

  const grandUdhar = customers.reduce((sum, c) => {
    const { balance } = getCustomerSummary(c.id);
    return sum + (balance > 0 ? balance : 0);
  }, 0);

  const udharCustomers = customers.filter((c) => getCustomerSummary(c.id).balance > 0).length;

  return (
    <>
      {showQR && <QRModal onClose={() => setShowQR(false)} />}

      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h2 className="text-2xl font-bold text-foreground">Aaj ka Hisab</h2>
            <p className="text-xs text-muted-foreground">आज का हिसाब</p>
            <p className="text-muted-foreground text-sm">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <SyncBadge status={syncStatus} lastSyncTime={lastSyncTime} onSync={syncNow} />
            <button
              onClick={() => setShowQR(true)}
              className="flex items-center gap-1.5 text-sm font-medium bg-card border border-border px-3 py-2 rounded-xl shadow-sm hover:bg-secondary transition-colors"
            >
              <QrCode className="w-4 h-4 text-primary" />
              Mera QR
            </button>
          </div>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Today's Total Income */}
          <div className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground p-4 rounded-2xl shadow-lg shadow-primary/20 flex flex-col justify-between min-h-[120px]">
            <div className="bg-white/20 w-fit p-2 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white/80 text-xs font-medium mb-0.5">Today's Income</p>
              <p className="text-[10px] text-white/60 mb-1">आज की कमाई</p>
              <p className="text-2xl font-bold leading-none">₹{todayTotalAmount.toLocaleString("en-IN")}</p>
              <p className="text-white/70 text-xs mt-1">{todayTotalKg} KG pisai</p>
            </div>
          </div>

          {/* Pending Udhar */}
          <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50 p-4 rounded-2xl flex flex-col justify-between min-h-[120px]">
            <div className="bg-amber-100 dark:bg-amber-900/40 w-fit p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-amber-800 dark:text-amber-300 text-xs font-medium mb-0.5">Pending Udhar</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 mb-1">बकाया उधार</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-200 leading-none">₹{grandUdhar.toLocaleString("en-IN")}</p>
              <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">{udharCustomers} grahak</p>
            </div>
          </div>

          {/* Today's KG */}
          <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between min-h-[100px]">
            <div className="bg-primary/10 w-fit p-2 rounded-lg">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">Today's KG</p>
              <p className="text-[10px] text-muted-foreground mb-1">आज का वजन</p>
              <p className="text-xl font-bold text-foreground">{todayTotalKg} KG</p>
            </div>
          </div>

          {/* Monthly Total */}
          <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between min-h-[100px]">
            <div className="bg-primary/10 w-fit p-2 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">This Month</p>
              <p className="text-[10px] text-muted-foreground mb-1">इस महीने</p>
              <p className="text-xl font-bold text-foreground">₹{monthlyTotal.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>

        {/* Cash vs Udhar breakdown */}
        {todaysRecords.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 flex gap-2">
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground">Cash</p>
              <p className="text-xs text-muted-foreground mb-1">नकद</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">₹{todayCash.toLocaleString("en-IN")}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground">Udhar</p>
              <p className="text-xs text-muted-foreground mb-1">उधार</p>
              <p className="text-lg font-bold text-red-500">₹{todayUdhar.toLocaleString("en-IN")}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground">Wajan</p>
              <p className="text-xs text-muted-foreground mb-1">वजन</p>
              <p className="text-lg font-bold text-foreground">{todayTotalKg} KG</p>
            </div>
          </div>
        )}

        {/* Today's entries */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Aaj ki Entries</h3>
              <p className="text-xs text-muted-foreground">आज की प्रविष्टियाँ</p>
            </div>
            {todaysRecords.length > 0 && (
              <Link href="/records" className="text-sm text-primary font-medium flex items-center gap-1">
                Sabhi dekhe <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {todaysRecords.length === 0 ? (
            <div className="bg-secondary/40 border border-dashed border-border rounded-2xl p-8 text-center flex flex-col items-center">
              <div className="bg-background w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <PlusCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium text-lg mb-1">Aaj koi entry nahi hai</p>
              <p className="text-muted-foreground text-sm mb-1">आज कोई प्रविष्टि नहीं है</p>
              <p className="text-muted-foreground text-sm mb-4">Shuruaat karne ke liye nayi entry jode</p>
              <Link href="/add">
                <Button className="rounded-full px-6 h-12 text-base">+ Naya Jode</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysRecords.slice(0, 5).map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
              {todaysRecords.length > 5 && (
                <Link href="/records" className="block text-center text-sm text-primary font-medium py-2">
                  + {todaysRecords.length - 5} aur dekhe
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
