import { useMemo, useState } from "react";
import { useRecords } from "@/hooks/use-records";
import { useKhata } from "@/hooks/use-khata";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isWithinInterval } from "date-fns";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";

type ReportTab = "daily" | "weekly" | "monthly" | "customer";

// Round to 2 decimal places to eliminate float drift
function r2(n: number) { return Math.round(n * 100) / 100; }

function StatCard({ label, labelHi, value, color }: { label: string; labelHi: string; value: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground mb-1">{labelHi}</p>
      <p className={`text-xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function fmtKg(kg: number) {
  const v = r2(kg);
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

export default function Reports() {
  const { records, isLoaded } = useRecords();
  const { customers, getCustomerSummary } = useKhata();
  const [tab, setTab] = useState<ReportTab>("daily");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedWeek, setSelectedWeek] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  // ── Daily ──
  const dailyRecords = useMemo(
    () => records.filter((r) => r.date === selectedDate),
    [records, selectedDate]
  );
  const dailyStats = useMemo(() => {
    const totalAmount = r2(dailyRecords.reduce((s, r) => s + r.total, 0));
    const totalKg = r2(dailyRecords.reduce((s, r) => s + r.kg, 0));
    const cash = r2(dailyRecords.filter((r) => r.paymentType === "cash").reduce((s, r) => s + r.total, 0));
    const udhar = r2(dailyRecords.filter((r) => r.paymentType === "udhar").reduce((s, r) => s + r.total, 0));
    const byAnaj: Record<string, { kg: number; amount: number }> = {};
    dailyRecords.forEach((r) => {
      if (!byAnaj[r.anaj]) byAnaj[r.anaj] = { kg: 0, amount: 0 };
      byAnaj[r.anaj].kg = r2(byAnaj[r.anaj].kg + r.kg);
      byAnaj[r.anaj].amount = r2(byAnaj[r.anaj].amount + r.total);
    });
    return { totalAmount, totalKg, cash, udhar, byAnaj, count: dailyRecords.length };
  }, [dailyRecords]);

  // ── Weekly ──
  const weekStart = useMemo(
    () => startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 }),
    [selectedWeek]
  );
  const weekEnd = useMemo(
    () => endOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 }),
    [selectedWeek]
  );
  const weeklyRecords = useMemo(
    () => records.filter((r) => isWithinInterval(parseISO(r.date), { start: weekStart, end: weekEnd })),
    [records, weekStart, weekEnd]
  );
  const weeklyStats = useMemo(() => {
    const totalAmount = r2(weeklyRecords.reduce((s, r) => s + r.total, 0));
    const totalKg = r2(weeklyRecords.reduce((s, r) => s + r.kg, 0));
    const cash = r2(weeklyRecords.filter((r) => r.paymentType === "cash").reduce((s, r) => s + r.total, 0));
    const udhar = r2(weeklyRecords.filter((r) => r.paymentType === "udhar").reduce((s, r) => s + r.total, 0));
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const byDay = days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayRecs = weeklyRecords.filter((r) => r.date === dateStr);
      return {
        date: dateStr,
        label: format(day, "EEE dd"),
        amount: r2(dayRecs.reduce((s, r) => s + r.total, 0)),
        kg: r2(dayRecs.reduce((s, r) => s + r.kg, 0)),
        count: dayRecs.length,
      };
    });
    return { totalAmount, totalKg, cash, udhar, byDay, count: weeklyRecords.length };
  }, [weeklyRecords, weekStart, weekEnd]);

  // ── Monthly ──
  const monthlyRecords = useMemo(
    () => records.filter((r) => r.date.startsWith(selectedMonth)),
    [records, selectedMonth]
  );
  const monthlyStats = useMemo(() => {
    const totalAmount = r2(monthlyRecords.reduce((s, r) => s + r.total, 0));
    const totalKg = r2(monthlyRecords.reduce((s, r) => s + r.kg, 0));
    const cash = r2(monthlyRecords.filter((r) => r.paymentType === "cash").reduce((s, r) => s + r.total, 0));
    const udhar = r2(monthlyRecords.filter((r) => r.paymentType === "udhar").reduce((s, r) => s + r.total, 0));
    const byAnaj: Record<string, { kg: number; amount: number; count: number }> = {};
    monthlyRecords.forEach((r) => {
      if (!byAnaj[r.anaj]) byAnaj[r.anaj] = { kg: 0, amount: 0, count: 0 };
      byAnaj[r.anaj].kg = r2(byAnaj[r.anaj].kg + r.kg);
      byAnaj[r.anaj].amount = r2(byAnaj[r.anaj].amount + r.total);
      byAnaj[r.anaj].count++;
    });
    return { totalAmount, totalKg, cash, udhar, byAnaj, count: monthlyRecords.length };
  }, [monthlyRecords]);

  // ── Customer-wise ──
  const customerReport = useMemo(
    () =>
      customers
        .map((c) => ({ ...c, ...getCustomerSummary(c.id) }))
        .sort((a, b) => b.balance - a.balance),
    [customers, getCustomerSummary]
  );

  if (!isLoaded) return null;

  const tabs: { key: ReportTab; label: string; labelHi: string }[] = [
    { key: "daily", label: "Daily", labelHi: "दैनिक" },
    { key: "weekly", label: "Weekly", labelHi: "साप्ताहिक" },
    { key: "monthly", label: "Monthly", labelHi: "मासिक" },
    { key: "customer", label: "Customer", labelHi: "ग्राहक" },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-xl">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reports</h2>
          <p className="text-muted-foreground text-xs">रिपोर्ट — Daily, Weekly, Monthly</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="grid grid-cols-4 gap-1 bg-secondary/50 p-1 rounded-2xl">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="block">{t.label}</span>
            <span className="text-[9px] opacity-70">{t.labelHi}</span>
          </button>
        ))}
      </div>

      {/* ── Daily Report ── */}
      {tab === "daily" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={today}
              className="flex-1 h-12 px-3 rounded-xl border border-border bg-card text-foreground text-base"
            />
            <button
              onClick={() => setSelectedDate(today)}
              className="h-12 px-4 rounded-xl bg-primary/10 text-primary font-semibold text-sm"
            >
              Aaj
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Income" labelHi="कुल कमाई" value={`₹${dailyStats.totalAmount.toLocaleString("en-IN")}`} color="text-primary" />
            <StatCard label="Total KG" labelHi="कुल वजन" value={`${fmtKg(dailyStats.totalKg)} KG`} />
            <StatCard label="Cash" labelHi="नकद" value={`₹${dailyStats.cash.toLocaleString("en-IN")}`} color="text-green-600 dark:text-green-400" />
            <StatCard label="Udhar" labelHi="उधार" value={`₹${dailyStats.udhar.toLocaleString("en-IN")}`} color="text-red-500" />
          </div>

          <p className="text-sm text-muted-foreground">
            {dailyStats.count} entries on {format(parseISO(selectedDate), "dd MMM, yyyy")}
          </p>

          {Object.keys(dailyStats.byAnaj).length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <p className="font-bold px-4 py-3 border-b border-border text-sm">Anaj-wise Breakdown</p>
              {Object.entries(dailyStats.byAnaj).map(([a, data]) => (
                <div key={a} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
                  <span className="font-semibold">🌾 {a}</span>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">{fmtKg(data.kg)} KG</p>
                    <p className="font-bold text-primary">₹{data.amount.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {dailyStats.count === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-lg">Is din koi entry nahi</p>
            </div>
          )}
        </div>
      )}

      {/* ── Weekly Report ── */}
      {tab === "weekly" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              max={today}
              className="flex-1 h-12 px-3 rounded-xl border border-border bg-card text-foreground text-base"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Week: {format(weekStart, "dd MMM")} – {format(weekEnd, "dd MMM, yyyy")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Income" labelHi="कुल कमाई" value={`₹${weeklyStats.totalAmount.toLocaleString("en-IN")}`} color="text-primary" />
            <StatCard label="Total KG" labelHi="कुल वजन" value={`${fmtKg(weeklyStats.totalKg)} KG`} />
            <StatCard label="Cash" labelHi="नकद" value={`₹${weeklyStats.cash.toLocaleString("en-IN")}`} color="text-green-600 dark:text-green-400" />
            <StatCard label="Udhar" labelHi="उधार" value={`₹${weeklyStats.udhar.toLocaleString("en-IN")}`} color="text-red-500" />
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <p className="font-bold px-4 py-3 border-b border-border text-sm">Din-wise Breakdown / Day-wise</p>
            {weeklyStats.byDay.map((d) => (
              <div key={d.date} className={`flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0 ${d.date === today ? "bg-primary/5" : ""}`}>
                <div>
                  <span className="font-semibold text-sm">{d.label}</span>
                  {d.date === today && (
                    <span className="ml-2 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Aaj</span>
                  )}
                  <p className="text-xs text-muted-foreground">{d.count} entries</p>
                </div>
                <div className="text-right text-sm">
                  {d.amount > 0 ? (
                    <>
                      <p className="text-muted-foreground">{fmtKg(d.kg)} KG</p>
                      <p className="font-bold text-primary">₹{d.amount.toLocaleString("en-IN")}</p>
                    </>
                  ) : <p className="text-muted-foreground text-xs">—</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly Report ── */}
      {tab === "monthly" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              max={format(new Date(), "yyyy-MM")}
              className="flex-1 h-12 px-3 rounded-xl border border-border bg-card text-foreground text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Monthly Income" labelHi="मासिक कमाई" value={`₹${monthlyStats.totalAmount.toLocaleString("en-IN")}`} color="text-primary" />
            <StatCard label="Total KG" labelHi="कुल वजन" value={`${fmtKg(monthlyStats.totalKg)} KG`} />
            <StatCard label="Cash" labelHi="नकद" value={`₹${monthlyStats.cash.toLocaleString("en-IN")}`} color="text-green-600 dark:text-green-400" />
            <StatCard label="Udhar" labelHi="उधार" value={`₹${monthlyStats.udhar.toLocaleString("en-IN")}`} color="text-red-500" />
          </div>

          <p className="text-sm text-muted-foreground">
            {monthlyStats.count} total entries in {format(parseISO(selectedMonth + "-01"), "MMMM yyyy")}
          </p>

          {Object.keys(monthlyStats.byAnaj).length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <p className="font-bold px-4 py-3 border-b border-border text-sm">Anaj-wise Summary</p>
              {Object.entries(monthlyStats.byAnaj)
                .sort((a, b) => b[1].amount - a[1].amount)
                .map(([a, data]) => (
                  <div key={a} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
                    <div>
                      <span className="font-semibold">🌾 {a}</span>
                      <p className="text-xs text-muted-foreground">{data.count} entries</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">{fmtKg(data.kg)} KG</p>
                      <p className="font-bold text-primary">₹{data.amount.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Customer-wise Report ── */}
      {tab === "customer" && (
        <div className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{customers.length} customers</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              Kul udhar: ₹{r2(customerReport.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)).toLocaleString("en-IN")}
            </p>
          </div>

          {customerReport.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-lg">Koi customer nahi hai abhi</p>
            </div>
          )}

          {customerReport.map((c) => (
            <div
              key={c.id}
              className={`bg-card border rounded-2xl overflow-hidden ${c.balance > 0 ? "border-red-200 dark:border-red-900/40" : "border-border"}`}
            >
              <button
                onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="text-left">
                  <p className="font-bold text-foreground">{c.name}</p>
                  {c.village && <p className="text-xs text-muted-foreground">🏘️ {c.village}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{c.txCount} transactions</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    {c.balance > 0 ? (
                      <p className="font-bold text-red-600 dark:text-red-400">₹{c.balance.toLocaleString("en-IN")} baaki</p>
                    ) : (
                      <p className="font-bold text-green-600 dark:text-green-400">Clear ✓</p>
                    )}
                  </div>
                  {expandedCustomer === c.id
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {expandedCustomer === c.id && (
                <div className="border-t border-border bg-secondary/20 p-4 space-y-2 animate-in slide-in-from-top-1 duration-150">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-card rounded-xl p-2">
                      <p className="text-xs text-muted-foreground">Kul KG</p>
                      <p className="font-bold">{fmtKg(c.totalKg)}</p>
                    </div>
                    <div className="bg-card rounded-xl p-2">
                      <p className="text-xs text-muted-foreground">Kul Amount</p>
                      <p className="font-bold">₹{c.totalAmount.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="bg-card rounded-xl p-2">
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="font-bold text-green-600 dark:text-green-400">₹{c.totalPaid.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  {c.mobile && c.balance > 0 && (
                    <a
                      href={`https://wa.me/91${c.mobile.slice(-10)}?text=${encodeURIComponent(
                        `🏭 Kanha Chakki\n\n${c.name} ji, aapka baaki udhar ₹${c.balance.toLocaleString("en-IN")} hai.\nUPI: 6266506662@ybl\n\nShukriya 🙏`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 bg-[#25D366]/10 text-[#25D366] py-2.5 rounded-xl text-sm font-bold"
                    >
                      WA Reminder bhejo
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
