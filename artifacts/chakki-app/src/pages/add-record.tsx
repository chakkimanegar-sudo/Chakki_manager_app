import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useRecords } from "@/hooks/use-records";
import { useSettings } from "@/hooks/use-settings";
import { useKhata } from "@/hooks/use-khata";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { englishNameToHindi } from "@/lib/english-name-to-hindi";
import { ArrowLeft, Banknote, BookOpen, Camera, Image as ImageIcon, X } from "lucide-react";

const ANAJ_OPTIONS = ["Gehu", "Makka", "Dal", "Besan", "Wata", "Bajra", "Jowar", "Chawal", "Anya"];

const ANAJ_HINDI: Record<string, string> = {
  Gehu: "गेहूं",
  Makka: "मक्का",
  Dal: "दाल",
  Besan: "बेसन",
  Wata: "वाटा",
  Bajra: "बाजरा",
  Jowar: "ज्वार",
  Chawal: "चावल",
  Anya: "अन्य",
};

export default function AddRecord() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const {
    records,
    addRecord,
    updateRecord,
    isLoaded: recordsLoaded,
  } = useRecords();

  const {
    rates,
    isLoaded: settingsLoaded,
  } = useSettings();

  const {
    findOrCreateCustomer,
    addTransaction,
    updateTransaction,
    deleteTransactionByRecordId,
    findTransactionByRecordId,
  } = useKhata();

  const { toast } = useToast();

  const isEdit = !!id;

  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [village, setVillage] = useState("");
  const [anaj, setAnaj] = useState("Gehu");
  const [kg, setKg] = useState("");
  const [rate, setRate] = useState(
    String(Math.round(rates["Gehu"] ?? 2))
  );
  const [date, setDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [notes, setNotes] = useState("");
  const [paymentType, setPaymentType] =
    useState<"cash" | "udhar">("cash");

  const [mobileError, setMobileError] = useState("");
  const [rateError, setRateError] = useState("");

  // 📸 Customer photo
  const [photo, setPhoto] = useState<string>("");

  // Use the in-page camera instead of Android's native camera intent.
  // Some Android browsers fail when returning a full-resolution photo to a web page.
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRequestId = useRef(0);

  const closeCamera = () => {
    cameraRequestId.current += 1;
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
    setCameraError("");
  };

  const startCamera = async () => {
    setCameraError("");
    setCameraOpen(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Is browser mein in-page camera available nahi hai. Camera permission check karein ya Gallery se photo lein.");
      return;
    }

    const requestId = ++cameraRequestId.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });

      if (requestId !== cameraRequestId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setCameraStream(stream);
    } catch (error) {
      if (requestId !== cameraRequestId.current) return;
      console.error("In-page camera could not start", error);
      setCameraError("Camera nahi khul paaya. Browser settings mein Camera permission allow karein, ya Gallery se photo lein.");
    }
  };

  useEffect(() => {
    if (!cameraStream) return;

    const video = videoRef.current;
    if (video) {
      video.srcObject = cameraStream;
      void video.play().catch((error) => {
        console.error("Camera preview could not start", error);
        setCameraError("Camera preview nahi chal paaya. Dobara koshish karein.");
      });
    }

    return () => {
      cameraStream.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [cameraStream]);

  const captureCameraPhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast({
        title: "Camera taiyar nahi hai. Ek second baad dobara dabayein.",
        variant: "destructive",
      });
      return;
    }

    let canvas: HTMLCanvasElement | undefined;
    try {
      const maxSide = 1280;
      const scale = Math.min(
        1,
        maxSide / Math.max(video.videoWidth, video.videoHeight)
      );
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));

      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo process nahi ho paayi");

      context.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas!.toBlob(resolve, "image/jpeg", 0.72);
      });
      if (!blob) throw new Error("Photo compress nahi ho paayi");

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("Photo read nahi ho paayi"));
        };
        reader.onerror = () => reject(new Error("Photo read nahi ho paayi"));
        reader.readAsDataURL(blob);
      });

      setPhoto(dataUrl);
      closeCamera();
      toast({ title: "✅ Photo aa gayi!" });
    } catch (error) {
      console.error("In-page photo capture failed", error);
      toast({
        title: "Photo save nahi ho paayi. Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  };

  // 📸 Gallery photo select
  const handlePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = e.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Sirf photo select karein",
        variant: "destructive",
      });
      input.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Photo 10MB se chhoti honi chahiye",
        variant: "destructive",
      });
      input.value = "";
      return;
    }

    let bitmap: ImageBitmap | undefined;
    let canvas: HTMLCanvasElement | undefined;

    try {
      // Ask the browser to downscale while decoding. Decoding a 12–50MP
      // camera photo at full size first can exhaust memory on low-end phones.
      const maxSide = 1280;
      bitmap = await createImageBitmap(file, {
        resizeWidth: maxSide,
        resizeQuality: "high",
      });

      // resizeWidth preserves the aspect ratio. For portrait photos, the
      // height can still exceed maxSide, so shrink the final canvas as needed.
      const scale = Math.min(
        1,
        maxSide / Math.max(bitmap.width, bitmap.height)
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Photo process nahi ho paayi");

      ctx.drawImage(bitmap, 0, 0, width, height);

      // toBlob uses less peak memory than creating a large base64 string
      // directly from the canvas. Convert only the already-compressed JPEG.
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas!.toBlob(resolve, "image/jpeg", 0.68);
      });
      if (!blob) throw new Error("Photo compress nahi ho paayi");

      const compressed = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("Photo read nahi ho paayi"));
        };
        reader.onerror = () => reject(new Error("Photo read nahi ho paayi"));
        reader.readAsDataURL(blob);
      });

      setPhoto(compressed);
    } catch (error) {
      console.error("Customer photo processing failed", error);
      toast({
        title: "Photo process nahi ho paayi. Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      bitmap?.close();
      if (canvas) {
        // Release canvas backing memory promptly on Android devices.
        canvas.width = 0;
        canvas.height = 0;
      }
      input.value = "";
    }
  };

  const removePhoto = () => {
    setPhoto("");
  };

  // Auto-fill integer rate when anaj changes
  useEffect(() => {
    if (!isEdit && settingsLoaded) {
      const r = rates[anaj];

      if (r !== undefined) {
        setRate(String(Math.round(r)));
      }
    }
  }, [anaj, rates, settingsLoaded, isEdit]);

  // Load existing record
  useEffect(() => {
    if (isEdit && recordsLoaded) {
      const record = records.find((r) => r.id === id);

      if (record) {
        setCustomerName(record.customerName);
        setMobile(record.mobile || "");
        setVillage(record.village || "");
        setAnaj(record.anaj);
        setKg(record.kg.toString());
        setRate(String(Math.round(record.rate)));
        setDate(record.date);
        setNotes(record.notes || "");
        setPaymentType(record.paymentType ?? "cash");

        // 📸 Existing photo
        setPhoto((record as any).photo || "");
      }
    }
  }, [id, records, recordsLoaded, isEdit]);

  const kgVal = parseFloat(kg) || 0;

  const rateVal = parseInt(rate, 10) || 0;

  const total =
    Math.round(kgVal * rateVal * 100) / 100;

  const handleAnajChange = (val: string) => {
    setAnaj(val);

    if (!isEdit) {
      const autoRate = rates[val];

      if (autoRate !== undefined) {
        setRate(String(Math.round(autoRate)));
      }
    }
  };

  const handleRateChange = (val: string) => {
    setRate(val);

    const num = parseFloat(val);

    if (
      val !== "" &&
      (!Number.isInteger(num) || num <= 0)
    ) {
      setRateError(
        "Rate sirf poora number hona chahiye — jaise 2, 3, 5"
      );
    } else {
      setRateError("");
    }
  };

  const validateMobile = (val: string) => {
    const digits = val.replace(/\D/g, "");

    setMobileError(
      digits.length > 0 && digits.length !== 10
        ? "Mobile number 10 digit ka hona chahiye"
        : ""
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() && !photo) {
      toast({
        title: "Grahak ka naam likhein ya photo khinchein",
        variant: "destructive",
      });
      return;
    }

    const mobileDigits = mobile.replace(/\D/g, "");

    if (
      mobileDigits.length > 0 &&
      mobileDigits.length !== 10
    ) {
      toast({
        title: "Mobile number 10 digit ka hona chahiye",
        variant: "destructive",
      });
      return;
    }

    if (!kg || kgVal <= 0) {
      toast({
        title: "Wajan (KG) sahi darj karein",
        variant: "destructive",
      });
      return;
    }

    if (!rate || rateVal <= 0) {
      toast({
        title: "Rate sahi darj karein",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isInteger(rateVal)) {
      toast({
        title: "Rate sirf poora number hona chahiye",
        variant: "destructive",
      });
      return;
    }

    if (total <= 0) {
      toast({
        title: "Total galat hai",
        variant: "destructive",
      });
      return;
    }

    // A photo-only entry still needs a non-empty internal label for cards and Khata bookkeeping.
    // A unique label prevents unidentified customers from being accidentally merged together.
    const savedCustomerName = customerName.trim() || `Photo Grahak ${Date.now()}`;

    const payload = {
      customerName: savedCustomerName,
      customerNameHindi: customerName.trim() ? englishNameToHindi(customerName.trim()) : "",
      mobile: mobileDigits,
      village: village.trim(),
      anaj,
      kg: kgVal,
      rate: rateVal,
      date,
      notes: notes.trim(),
      paymentType,

      // 📸 Photo
      photo,
    };

    try {
      if (isEdit) {
        const oldRecord = records.find(
          (r) => r.id === id
        );

        updateRecord(id!, payload);

        if (paymentType === "udhar") {
          const { customer } =
            findOrCreateCustomer(
              savedCustomerName,
              mobileDigits,
              village.trim()
            );

          const existingTx =
            findTransactionByRecordId(id!);

          if (existingTx) {
            if (existingTx.customerId !== customer.id) {
              // The billing record moved to another customer. Replace the
              // linked ledger transaction instead of leaving the debt under
              // the old customer.
              deleteTransactionByRecordId(id!);
              addTransaction({
                customerId: customer.id,
                type: "udhar",
                amount: total,
                anaj,
                kg: kgVal,
                rate: rateVal,
                date,
                notes: notes.trim(),
                recordId: id!,
              });
            } else {
              updateTransaction(existingTx.id, {
                amount: total,
                anaj,
                kg: kgVal,
                rate: rateVal,
                date,
                notes: notes.trim(),
              });
            }
          } else {
            addTransaction({
              customerId: customer.id,
              type: "udhar",
              amount: total,
              anaj,
              kg: kgVal,
              rate: rateVal,
              date,
              notes: notes.trim(),
              recordId: id!,
            });
          }
        } else if (
          oldRecord?.paymentType === "udhar"
        ) {
          deleteTransactionByRecordId(id!);
        }

        toast({
          title: "✅ Entry update ho gayi!",
        });
      } else {
        const newRecord = addRecord(payload);

        if (paymentType === "udhar") {
          const { customer, isNew } =
            findOrCreateCustomer(
              savedCustomerName,
              mobileDigits,
              village.trim()
            );

          addTransaction({
            customerId: customer.id,
            type: "udhar",
            amount: newRecord.total,
            anaj,
            kg: kgVal,
            rate: rateVal,
            date,
            notes: notes.trim(),
            recordId: newRecord.id,
          });

          toast({
            title: `✅ Save ho gayi! ₹${newRecord.total.toLocaleString(
              "en-IN"
            )} — Khata mein ${
              isNew ? "naya grahak add hua" : "udhar joda"
            } 📒`,
          });
        } else {
          toast({
            title: `✅ Save ho gayi! ₹${newRecord.total.toLocaleString(
              "en-IN"
            )} — Cash 💵`,
          });
        }
      }

      setLocation("/");
    } catch (err) {
      toast({
        title: "Error: " + String(err),
        variant: "destructive",
      });
    }
  };       
    return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="bg-secondary text-secondary-foreground p-2.5 rounded-xl hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isEdit ? "Entry Edit Karein" : "Nayi Entry"}
          </h2>

          <p className="text-muted-foreground text-xs">
            {isEdit ? "एंट्री अपडेट करें" : "नई प्रविष्टि"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Customer Name */}
        <div className="space-y-1.5">
          <Label
            htmlFor="customerName"
            className="text-base font-semibold"
          >
            👤 Grahak ka Naam (Optional)
          </Label>

          <Input
            id="customerName"
            placeholder="Naam likhein (photo se bhi save kar sakte hain)"
            value={customerName}
            onChange={(e) =>
              setCustomerName(e.target.value)
            }
            className="h-14 text-base"
          />
        </div>

        {customerName.trim() && englishNameToHindi(customerName.trim()) && (
          <p className="text-sm font-semibold text-muted-foreground -mt-2 px-1" aria-live="polite">
            हिंदी नाम: {englishNameToHindi(customerName.trim())}
          </p>
        )}

        {/* Mobile */}
        <div className="space-y-1.5">
          <Label
            htmlFor="mobile"
            className="text-base font-semibold"
          >
            📞 Mobile Number (Optional)
          </Label>

          <Input
            id="mobile"
            type="tel"
            inputMode="numeric"
            placeholder="10 digit mobile number"
            value={mobile}
            onChange={(e) => {
              setMobile(e.target.value);
              validateMobile(e.target.value);
            }}
            className={`h-14 text-base ${
              mobileError ? "border-destructive" : ""
            }`}
          />

          {mobileError && (
            <p className="text-xs text-destructive">
              {mobileError}
            </p>
          )}
        </div>

        {/* Village */}
        <div className="space-y-1.5">
          <Label
            htmlFor="village"
            className="text-base font-semibold"
          >
            🏘️ Gaon / गाँव (Optional)
          </Label>

          <Input
            id="village"
            placeholder="Grahak ka gaon..."
            value={village}
            onChange={(e) =>
              setVillage(e.target.value)
            }
            className="h-14 text-base"
          />
        </div>

        {/* 📸 PHOTO */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">
            📸 Grahak ka Photo (Optional)
          </Label>

          {!photo ? (
            <div className="grid grid-cols-2 gap-3">

              {/* Camera: capture a small image directly in the page, avoiding Android's full-size file return. */}
              <button
                type="button"
                onClick={startCamera}
                className="h-14 rounded-2xl border-2 border-dashed border-border flex items-center justify-center gap-2 hover:bg-secondary/50 transition-colors"
              >
                <Camera className="w-5 h-5" />
                <span className="font-semibold">Camera</span>
              </button>

              {/* Gallery */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />

                <div className="h-14 rounded-2xl border-2 border-dashed border-border flex items-center justify-center gap-2 hover:bg-secondary/50 transition-colors">
                  <ImageIcon className="w-5 h-5" />
                  <span className="font-semibold">
                    Gallery
                  </span>
                </div>
              </label>

            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border bg-secondary">
              <img
                src={photo}
                alt="Customer"
                className="w-full max-h-72 object-contain"
              />

              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Photo 5MB tak ho sakta hai.
          </p>
        </div>

        {/* Anaj */}
        <div className="space-y-1.5">
          <Label className="text-base font-semibold">
            🌾 Anaj / अनाज *
          </Label>

          <Select
            value={anaj}
            onValueChange={handleAnajChange}
          >
            <SelectTrigger className="h-14 text-base">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {ANAJ_OPTIONS.map((a) => (
                <SelectItem
                  key={a}
                  value={a}
                  className="text-base py-3"
                >
                  {a}
                  {ANAJ_HINDI[a]
                    ? ` — ${ANAJ_HINDI[a]}`
                    : ""}
                  {rates[a] !== undefined
                    ? ` (₹${Math.round(rates[a])}/KG)`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KG + Rate */}
        <div className="grid grid-cols-2 gap-3">

          <div className="space-y-1.5">
            <Label
              htmlFor="kg"
              className="text-base font-semibold"
            >
              ⚖️ Wajan (KG) *
            </Label>

            <Input
              id="kg"
              type="number"
              step="0.5"
              min="0.5"
              inputMode="decimal"
              placeholder="0.0"
              value={kg}
              onChange={(e) =>
                setKg(e.target.value)
              }
              className="h-14 text-base"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="rate"
              className="text-base font-semibold"
            >
              💵 Rate (₹/KG) *
            </Label>

            <Input
              id="rate"
              type="number"
              step="1"
              min="1"
              inputMode="numeric"
              placeholder="2"
              value={rate}
              onChange={(e) =>
                handleRateChange(e.target.value)
              }
              className={`h-14 text-base ${
                rateError ? "border-destructive" : ""
              }`}
              required
            />

            {rateError && (
              <p className="text-xs text-destructive">
                {rateError}
              </p>
            )}
          </div>

        </div>

        {/* Payment Type */}
        <div className="space-y-1.5">
          <Label className="text-base font-semibold">
            💳 Payment / भुगतान *
          </Label>

          <div className="grid grid-cols-2 gap-3">

            <button
              type="button"
              onClick={() =>
                setPaymentType("cash")
              }
              className={`flex items-center justify-center gap-2 h-14 rounded-2xl border-2 font-bold text-base transition-all ${
                paymentType === "cash"
                  ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600"
                  : "border-border text-foreground hover:border-green-300"
              }`}
            >
              <Banknote className="w-5 h-5" />
              Cash
            </button>

            <button
              type="button"
              onClick={() =>
                setPaymentType("udhar")
              }
              className={`flex items-center justify-center gap-2 h-14 rounded-2xl border-2 font-bold text-base transition-all ${
                paymentType === "udhar"
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600"
                  : "border-border text-foreground hover:border-red-300"
              }`}
            >
              <BookOpen className="w-5 h-5" />
              Udhar
            </button>

          </div>

          {paymentType === "udhar" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2">
              📒 Udhar save hone par grahak ki Khata
              Book mein automatically entry hogi
            </p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label
            htmlFor="date"
            className="text-base font-semibold"
          >
            📅 Tarikh / तारीख
          </Label>

          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) =>
              setDate(e.target.value)
            }
            className="h-14 text-base"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label
            htmlFor="notes"
            className="text-base font-semibold"
          >
            📝 Notes (Optional)
          </Label>

          <Input
            id="notes"
            placeholder="Koi khaas baat..."
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
            className="h-14 text-base"
          />
        </div>

        {/* Live Total Preview */}
        {total > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">

            <p className="text-sm font-medium text-muted-foreground mb-2">
              Calculation / गणना
            </p>

            <div className="flex justify-between items-center">

              <div>
                <p className="font-bold text-foreground">
                  {customerName || "Grahak"}
                </p>

                <p className="text-sm text-muted-foreground">
                  {anaj} · {kg} KG × ₹{rateVal}/KG
                </p>
              </div>

              <div className="text-right">

                <p className="text-2xl font-bold text-primary">
                  ₹{total.toLocaleString("en-IN")}
                </p>

                <p
                  className={`text-sm font-semibold ${
                    paymentType === "cash"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-500"
                  }`}
                >
                  {paymentType === "cash"
                    ? "✅ Cash"
                    : "📒 Udhar"}
                </p>

              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <Button
          type="submit"
          className="w-full h-16 text-xl font-bold rounded-2xl"
        >
          {isEdit
            ? "✅ Update Karein"
            : "💾 Save Karein"}

          <span className="text-sm font-normal opacity-80 ml-2">
            {isEdit
              ? "अपडेट करें"
              : "सेव करें"}
          </span>
        </Button>

      </form>

      {cameraOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black p-4 text-white">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <h3 className="text-lg font-bold">Grahak ka Photo</h3>
              <p className="text-xs text-white/70">Photo app ke andar hi capture hogi</p>
            </div>
            <button
              type="button"
              onClick={closeCamera}
              className="rounded-full bg-white/15 p-3"
              aria-label="Camera band karein"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {cameraError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <Camera className="h-12 w-12 text-white/70" />
              <p className="max-w-sm text-sm">{cameraError}</p>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-xl bg-white px-5 py-3 font-bold text-black"
              >
                Wapas jaayein
              </button>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-zinc-900">
              {cameraStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-contain"
                  aria-label="Camera preview"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center text-white/80">
                  <Camera className="h-10 w-10 animate-pulse" />
                  <p>Camera khul raha hai...</p>
                </div>
              )}
            </div>
          )}

          {!cameraError && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-xl border border-white/40 px-5 py-3 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureCameraPhoto}
                disabled={!cameraStream}
                className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-white disabled:opacity-50"
              >
                📸 Photo Khichein
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}