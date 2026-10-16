import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useKhata } from "@/hooks/use-khata";
import { useRecords } from "@/hooks/use-records";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus, ChevronRight, Phone, BookOpen, Scale, Wallet, Search, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.112 1.523 5.836L.057 23.286a.75.75 0 0 0 .918.93l5.618-1.474A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.884 0-3.65-.52-5.16-1.427l-.37-.22-3.835 1.006 1.02-3.727-.242-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
);

export default function Khata() {
  const { customers, isLoaded, findOrCreateCustomer, deleteCustomer, getCustomerSummary, getCustomerTransactions } = useKhata();
  const { records } = useRecords();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [village, setVillage] = useState("");
  const [mobileError, setMobileError] = useState("");

  const filteredCustomers = useMemo(() => {
    const q = search.trim().normalize("NFC").toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.name.normalize("NFC").toLowerCase().includes(q) ||
      (c.mobile && c.mobile.includes(q)) ||
      (c.village && c.village.normalize("NFC").toLowerCase().includes(q))
    );
  }, [customers, search]);

  // Sort by balance desc (most outstanding first)
  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      const ba = getCustomerSummary(a.id).balance;
      const bb = getCustomerSummary(b.id).balance;
      return bb - ba;
    });
  }, [filteredCustomers, getCustomerSummary]);

  const handleAdd = () => {
    if (!name.trim()) {
      toast({ title: "Naam zaroori hai", variant: "destructive" }); return;
    }
    const mobileDigits = mobile.replace(/\D/g, "");
    if (mobileDigits.length > 0 && mobileDigits.length !== 10) {
      toast({ title: "Mobile number 10 digit ka hona chahiye", variant: "destructive" }); return;
    }

    const { customer, isNew } = findOrCreateCustomer(name.trim(), mobileDigits, village.trim());
    setName(""); setMobile(""); setVillage(""); setMobileError(""); setShowAdd(false);

    if (isNew) {
      toast({ title: `${customer.name} ki khata khul gayi! 📒` });
      setLocation(`/khata/${customer.id}`);
    } else {
      toast({ title: `${customer.name} pehle se hai — khata khul rahi hai` });
      setLocation(`/khata/${customer.id}`);
    }
  };

  const handleDelete = (id: string, customerName: string) => {
    if (confirm(`${customerName} ki khata delete karein? Agar is khate mein koi lena-dena nahi hai tabhi delete hoga.`)) {
      const deleted = deleteCustomer(id);
      if (deleted) {
        toast({ title: "Khata delete ho gayi" });
      } else {
        toast({ title: "Is khate mein lena-dena hai — pehle transactions delete karein", variant: "destructive" });
      }
    }
  };

  const sendWhatsAppReminder = (e: React.MouseEvent, c: { id: string; name: string; mobile: string }) => {
    e.stopPropagation();
    const { balance } = getCustomerSummary(c.id);

    if (balance <= 0) {
      toast({ title: "Is grahak ka koi udhar baaki nahi hai" }); return;
    }
    if (!c.mobile) {
      toast({ title: "Mobile number nahi hai — pehle number dalein", variant: "destructive" }); return;
    }

    const txList = getCustomerTransactions(c.id);
    const udharEntries = txList.filter((t) => t.type === "udhar");
    const lines = udharEntries.map((t) => {
      if (t.anaj && t.kg) {
        return `• ${t.date}: ${t.anaj} ${t.kg}KG = ₹${t.amount.toLocaleString("en-IN")}`;
      }
      return `• ${t.date}: ₹${t.amount.toLocaleString("en-IN")}`;
    }).join("\n");

    const message =
      `🏭 *Kanha Chakki — Udhar Reminder*\n\n` +
      `Pranam ${c.name} ji 🙏\n\n` +
      `Aapka kul baaki udhar: *₹${balance.toLocaleString("en-IN")}*\n\n` +
      (lines ? `📋 Details:\n${lines}\n\n` : "") +
      `💳 Payment QR:\nUPI ID: 6266506662@ybl\n\n` +
      `Payment ho jaye toh bata dein. Shukriya! 🙏`;

    const mob = c.mobile.replace(/\D/g, "");
    window.open(`https://wa.me/91${mob.slice(-10)}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (!isLoaded) return null;

  const totalPendingUdhar = customers.reduce((s, c) => {
    const { balance } = getCustomerSummary(c.id);
    return s + (balance > 0 ? balance : 0);
  }, 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Khata Book</h2>
          <p className="text-xs text-muted-foreground mb-1">खाता बही</p>
          <p className="text-sm text-muted-foreground">{customers.length} grahak · Kul udhar: <span className="font-bold text-red-600 dark:text-red-400">₹{totalPendingUdhar.toLocaleString("en-IN")}</span></p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-2 rounded-xl">
          <UserPlus className="w-4 h-4" />
          Naya
        </Button>
      </div>

      {/* Add customer form */}
      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-2xl p-4 shadow-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
          <h3 className="font-bold text-base">📒 Naya Grahak / Khata</h3>
          <div className="space-y-2">
            <Input
              placeholder="Naam *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-12 text-base"
              autoFocus
            />
            <Input
              placeholder="Mobile (10 digit, optional)"
              type="tel"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                const d = e.target.value.replace(/\D/g, "");
                setMobileError(d.length > 0 && d.length !== 10 ? "10 digit chahiye" : "");
              }}
              className={`h-12 text-base ${mobileError ? "border-destructive" : ""}`}
            />
            {mobileError && <p className="text-xs text-destructive">{mobileError}</p>}
            <Input
              placeholder="Gaon / Village (optional)"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} className="flex-1 h-12 rounded-xl">✅ Khata Kholein</Button>
            <Button variant="outline" onClick={() => { setShowAdd(false); setName(""); setMobile(""); setVillage(""); }} className="h-12 rounded-xl">Raho</Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Naam, mobile ya gaon se khojein..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base rounded-xl bg-card shadow-sm"
        />
      </div>

      {/* Customer list */}
      {sortedCustomers.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground space-y-3">
          <BookOpen className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-lg font-medium">{search ? "Koi grahak nahi mila" : "Koi khata nahi hai"}</p>
          {!search && <p className="text-sm">Upar "Naya" dabake pehla khata kholein</p>}
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {sortedCustomers.map((c) => {
            const { totalKg, totalAmount, totalPaid, balance, txCount } = getCustomerSummary(c.id);
            const customerMobile = (c.mobile || "").replace(/\D/g, "");
            const normalizedCustomerName = c.name.trim().normalize("NFC").toLowerCase().replace(/\s+/g, " ");
            const matchingRecords = records.filter((r) => {
              const recordMobile = (r.mobile || "").replace(/\D/g, "");
              const normalizedRecordName = r.customerName.trim().normalize("NFC").toLowerCase().replace(/\s+/g, " ");
              if (customerMobile && recordMobile) return customerMobile === recordMobile;
              return normalizedRecordName === normalizedCustomerName;
            }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            const profilePhoto = matchingRecords.find((r) => r.photo)?.photo;
            const profileHindiName = matchingRecords.find((r) => r.customerNameHindi?.trim())?.customerNameHindi?.trim();

            return (
              <div
                key={c.id}
                onClick={() => setLocation(`/khata/${c.id}`)}
                className={`bg-card border rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.99] ${
                  balance > 0 ? "border-red-200 dark:border-red-900/40" : "border-border"
                }`}
              >
                {/* Main row */}
                <div className="flex items-center justify-between p-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {profilePhoto ? (
                      <img
                        src={profilePhoto}
                        alt={`${c.name} customer`}
                        className="w-14 h-14 rounded-full object-cover border border-border flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-secondary text-muted-foreground flex items-center justify-center flex-shrink-0" aria-label="Customer photo not added">
                        <span className="text-lg font-bold">{c.name.slice(0, 1).toLocaleUpperCase()}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground text-base break-words">{c.name}</p>
                      {profileHindiName && (
                        <p className="text-sm font-semibold text-muted-foreground leading-tight mt-0.5">{profileHindiName}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {c.mobile && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />{c.mobile}
                          </span>
                        )}
                        {c.village && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{c.village}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{txCount} transactions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-1">
                    {c.mobile && balance > 0 && (
                      <button
                        onClick={(e) => sendWhatsAppReminder(e, c)}
                        className="p-2 rounded-xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                        title="WhatsApp reminder"
                      >
                        {WA_ICON}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.name); }}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      🗑️
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 border-t border-border/60 bg-secondary/20">
                  <div className="flex flex-col items-center py-3 px-2 border-r border-border/60">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                      <Scale className="w-3 h-3" /> Kul KG
                    </span>
                    <span className="text-sm font-bold text-foreground">{totalKg % 1 === 0 ? totalKg : totalKg.toFixed(2)} KG</span>
                  </div>
                  <div className="flex flex-col items-center py-3 px-2 border-r border-border/60">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                      <Wallet className="w-3 h-3" /> Kul Rakam
                    </span>
                    <span className="text-sm font-bold text-foreground">₹{totalAmount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col items-center py-3 px-2">
                    <span className="text-[10px] text-muted-foreground mb-0.5">Baaki</span>
                    {balance > 0 ? (
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">₹{balance.toLocaleString("en-IN")}</span>
                    ) : balance < 0 ? (
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">+₹{Math.abs(balance).toLocaleString("en-IN")}</span>
                    ) : (
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">Clear ✓</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
