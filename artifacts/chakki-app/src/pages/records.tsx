import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useRecords } from "@/hooks/use-records";
import { useKhata } from "@/hooks/use-khata";
import { RecordCard } from "@/components/RecordCard";
import { Input } from "@/components/ui/input";
import { Search, FilterX } from "lucide-react";
import { format } from "date-fns";

const ANAJ_FILTERS = ["Gehu", "Makka", "Dal", "Besan", "Wata"];
const PAYMENT_FILTERS = ["Cash", "Udhar"];

export default function Records() {
  const { records, deleteRecord, isLoaded } = useRecords();
  const { deleteTransactionByRecordId } = useKhata();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [anajFilter, setAnajFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const q = search.trim().normalize("NFC").toLowerCase();
        const matchesSearch =
          !search ||
          r.customerName.normalize("NFC").toLowerCase().includes(q) ||
          (r.mobile && r.mobile.includes(search.trim())) ||
          (r.village && r.village.normalize("NFC").toLowerCase().includes(q)) ||
          r.anaj.toLowerCase().includes(q);
        const matchesDate = !dateFilter || r.date === dateFilter;
        const matchesAnaj = !anajFilter || r.anaj === anajFilter;
        const matchesPayment =
          !paymentFilter ||
          (paymentFilter === "Cash" && r.paymentType === "cash") ||
          (paymentFilter === "Udhar" && r.paymentType === "udhar");
        return matchesSearch && matchesDate && matchesAnaj && matchesPayment;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt - a.createdAt);
  }, [records, search, dateFilter, anajFilter, paymentFilter]);

  const groupedRecords = useMemo(() => {
    const groups: Record<string, typeof records> = {};
    filteredRecords.forEach((r) => {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    });
    return groups;
  }, [filteredRecords]);

  const totalFilteredAmount = filteredRecords.reduce((s, r) => s + r.total, 0);
  const totalFilteredKg = filteredRecords.reduce((s, r) => s + r.kg, 0);
  const hasFilter = search || dateFilter || anajFilter || paymentFilter;

  if (!isLoaded) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">Sabhi Records</h2>
        <p className="text-muted-foreground text-sm">{records.length} total entries</p>
      </div>

      {/* Sticky filter area */}
      <div className="space-y-3 sticky top-[80px] z-10 bg-background/95 backdrop-blur py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Naam, mobile, gaon ya anaj se khojein..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base rounded-xl shadow-sm bg-card"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {ANAJ_FILTERS.map((a) => (
            <button
              key={a}
              onClick={() => setAnajFilter(anajFilter === a ? "" : a)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                anajFilter === a
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-card border-border text-foreground hover:bg-secondary"
              }`}
            >
              🌾 {a}
            </button>
          ))}
          {PAYMENT_FILTERS.map((p) => (
            <button
              key={p}
              onClick={() => setPaymentFilter(paymentFilter === p ? "" : p)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                paymentFilter === p
                  ? p === "Cash"
                    ? "bg-green-500 text-white border-green-500 shadow"
                    : "bg-red-500 text-white border-red-500 shadow"
                  : "bg-card border-border text-foreground hover:bg-secondary"
              }`}
            >
              {p === "Cash" ? "💵" : "📒"} {p}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-11 rounded-xl shadow-sm bg-card flex-1"
          />
          {hasFilter && (
            <button
              onClick={() => { setSearch(""); setDateFilter(""); setAnajFilter(""); setPaymentFilter(""); }}
              className="px-3 rounded-xl bg-secondary text-secondary-foreground flex items-center gap-1.5 text-sm font-medium shadow-sm"
            >
              <FilterX className="w-4 h-4" /> Clear
            </button>
          )}
        </div>

        {/* Summary bar */}
        {filteredRecords.length > 0 && (
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{filteredRecords.length} records</span>
            <span className="text-muted-foreground">{totalFilteredKg} KG</span>
            <span className="font-bold text-primary">₹{totalFilteredAmount.toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>

      {Object.keys(groupedRecords).length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <p className="text-lg">Koi record nahi mila</p>
          {hasFilter && <p className="text-sm mt-1">Filter hata ke dekhein</p>}
        </div>
      ) : (
        <div className="space-y-8 pb-4">
          {Object.entries(groupedRecords).map(([date, dateRecords]) => {
            const dateTotal = dateRecords.reduce((sum, r) => sum + r.total, 0);
            const dateKg = dateRecords.reduce((sum, r) => sum + r.kg, 0);
            const cashTotal = dateRecords.filter((r) => r.paymentType === "cash").reduce((s, r) => s + r.total, 0);
            const udharTotal = dateRecords.filter((r) => r.paymentType === "udhar").reduce((s, r) => s + r.total, 0);

            return (
              <div key={date} className="space-y-3">
                <div className="flex items-end justify-between border-b border-border pb-2 px-1">
                  <h3 className="font-bold text-lg">
                    {format(new Date(date + "T00:00:00"), "dd MMM, yyyy")}
                  </h3>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{dateKg} KG</p>
                    <p className="text-sm font-bold text-primary">₹{dateTotal.toLocaleString("en-IN")}</p>
                    <div className="flex gap-2 justify-end mt-0.5">
                      {cashTotal > 0 && <span className="text-[10px] text-green-700 dark:text-green-400 font-semibold">💵 {cashTotal.toLocaleString("en-IN")}</span>}
                      {udharTotal > 0 && <span className="text-[10px] text-red-700 dark:text-red-400 font-semibold">📒 {udharTotal.toLocaleString("en-IN")}</span>}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {dateRecords.map((record) => (
                    <RecordCard
                      key={record.id}
                      record={record}
                      onEdit={(id) => setLocation(`/edit/${id}`)}
                      onDelete={(id) => {
                        // Udhar billing has a linked Khata transaction.
                        // Delete both together so the ledger never keeps a ghost debt.
                        deleteTransactionByRecordId(id);
                        deleteRecord(id);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
