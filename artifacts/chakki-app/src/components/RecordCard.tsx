import { RecordEntry } from "@/lib/types";
import React from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, Banknote, BookOpen, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordCardProps {
  record: RecordEntry;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function buildMessage(record: RecordEntry): string {
  const payLabel = record.paymentType === "udhar" ? "📒 Udhar (baad mein dega)" : "💵 Cash (diya ja chuka hai)";
  return (
    `🏭 *Kanha Chakki*\n\n` +
    `👤 Customer: ${record.customerName}\n` +
    (record.mobile ? `📞 Mobile: ${record.mobile}\n` : "") +
    (record.village ? `🏘️ Village: ${record.village}\n` : "") +
    `\n🌾 Anaj: ${record.anaj}\n` +
    `⚖️ Wajan: ${record.kg} KG\n` +
    `💵 Rate: ₹${record.rate}/KG\n` +
    `💰 *Total: ₹${record.total.toLocaleString("en-IN")}*\n\n` +
    `📅 Tarikh: ${format(new Date(record.date + "T00:00:00"), "dd MMM, yyyy")}\n` +
    `💳 Payment: ${payLabel}\n\n` +
    `💳 *Payment ke liye scan karein:*\n` +
    `UPI ID: 6266506662@ybl\n\n` +
    `_Shukriya! 🙏 — Kanha Chakki_`
  );
}

async function shareWithQR(record: RecordEntry) {
  const message = buildMessage(record);

  if (navigator.canShare) {
    try {
      const res = await fetch("/upi-qr.jpg");
      const blob = await res.blob();
      const file = new File([blob], "payment-qr.jpg", { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ text: message, files: [file] });
        return;
      }
    } catch (_) {}
  }

  const encoded = encodeURIComponent(message);
  const mobile = record.mobile?.replace(/\D/g, "");
  const url =
    mobile && mobile.length >= 10
      ? `https://wa.me/91${mobile.slice(-10)}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank");
}

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.112 1.523 5.836L.057 23.286a.75.75 0 0 0 .918.93l5.618-1.474A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.884 0-3.65-.52-5.16-1.427l-.37-.22-3.835 1.006 1.02-3.727-.242-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
  </svg>
);

export function RecordCard({ record, onEdit, onDelete }: RecordCardProps) {
  const isUdhar = record.paymentType === "udhar";
  const [photoExpanded, setPhotoExpanded] = React.useState(false);

  return (
    <Card className={`border ${isUdhar ? "border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/20" : "border-border bg-card"} rounded-2xl shadow-sm overflow-hidden`}>
      {photoExpanded && record.photo && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${record.customerName} photo`}
          onClick={() => setPhotoExpanded(false)}
        >
          <button
            type="button"
            className="absolute top-5 right-5 rounded-full bg-white/15 text-white p-2"
            onClick={() => setPhotoExpanded(false)}
            aria-label="Close photo"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-full max-h-full flex flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
            <img
              src={record.photo}
              alt={`${record.customerName} customer full photo`}
              className="max-w-[90vw] max-h-[78vh] object-contain rounded-xl"
            />
            <p className="text-white text-lg font-semibold text-center">
              {record.customerName}
              {record.customerNameHindi?.trim() ? ` · ${record.customerNameHindi.trim()}` : ""}
            </p>
          </div>
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        {/* Row 1: customer photo + bilingual name + payment badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {record.photo ? (
              <button
                type="button"
                onClick={() => setPhotoExpanded(true)}
                className="rounded-full flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`View ${record.customerName}'s full photo`}
                title="Photo badi karke dekhein"
              >
                <img
                  src={record.photo}
                  alt={`${record.customerName} customer`}
                  className="w-14 h-14 rounded-full object-cover border border-border"
                  loading="lazy"
                />
              </button>
            ) : (
              <div className="w-14 h-14 rounded-full bg-secondary text-muted-foreground flex items-center justify-center flex-shrink-0" aria-label="Customer photo not added">
                <UserRound className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-base leading-tight break-words">{record.customerName}</p>
              {record.customerNameHindi?.trim() && (
                <p className="text-sm font-semibold text-muted-foreground leading-tight mt-0.5">{record.customerNameHindi.trim()}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {record.mobile && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    📞 {record.mobile}
                  </span>
                )}
                {record.village && (
                  <span className="text-xs text-muted-foreground">🏘️ {record.village}</span>
                )}
              </div>
            </div>
          </div>
          <div className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isUdhar ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
            {isUdhar ? <BookOpen className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
            {isUdhar ? "Udhar" : "Cash"}
          </div>
        </div>

        {/* Row 2: grain details */}
        <div className="grid grid-cols-4 gap-1 bg-secondary/40 rounded-xl p-2.5 text-center">
          <div>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Anaj</p>
            <p className="text-sm font-bold mt-0.5">🌾 {record.anaj}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Wajan</p>
            <p className="text-sm font-bold mt-0.5">{record.kg} KG</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Rate</p>
            <p className="text-sm font-bold mt-0.5">₹{record.rate}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Total</p>
            <p className="text-sm font-bold text-primary mt-0.5">₹{record.total.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {/* Row 3: date + notes */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>📅 {format(new Date(record.date + "T00:00:00"), "dd MMM, yyyy")}</span>
          {record.notes && (
            <span className="italic truncate max-w-[140px] text-right">"{record.notes}"</span>
          )}
        </div>

        {/* Row 4: actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => shareWithQR(record)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5c] active:bg-[#1aad52] text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
          >
            <WhatsAppIcon />
            Bill + QR bhejo
          </button>
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(record.id)}
              className="h-10 px-3"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`${record.customerName} ki entry delete karein?`)) {
                  onDelete(record.id);
                }
              }}
              className="h-10 px-3 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
