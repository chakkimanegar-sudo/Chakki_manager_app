import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useSync } from "@/hooks/use-sync";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Settings as SettingsIcon, Save, Link2, RefreshCw, Unlink,
  Check, Wifi, WifiOff, AlertCircle, Moon, Sun, Download, Upload,
} from "lucide-react";

const ANAJ_EMOJIS: Record<string, string> = {
  Gehu: "🌾", Makka: "🌽", Dal: "🫘", Besan: "🟡", Wata: "💧",
};

const ANAJ_HINDI: Record<string, string> = {
  Gehu: "गेहूं", Makka: "मक्का", Dal: "दाल", Besan: "बेसन", Wata: "वाटा",
};

export default function Settings() {
  const { rates, isLoaded, saveRates } = useSettings();
  const { shopCode, syncStatus, syncError, lastSyncTime, apiServerUrl, saveApiServerUrl, testApiConnection, setupShop, syncNow, disconnectShop } = useSync();
  const { isDark, toggleTheme } = useTheme();
  const { toast } = useToast();

  // Store local rates as integer strings for the input fields
  const [localRates, setLocalRates] = useState<Record<string, string>>({});
  const [codeInput, setCodeInput] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(apiServerUrl);
  const [isTestingServer, setIsTestingServer] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      const asStrings: Record<string, string> = {};
      Object.keys(rates).forEach((k) => { asStrings[k] = String(Math.round(rates[k])); });
      setLocalRates(asStrings);
    }
  }, [isLoaded, rates]);

  useEffect(() => {
    setServerUrlInput(apiServerUrl);
  }, [apiServerUrl]);

  const handleSaveApiServer = () => {
    const result = saveApiServerUrl(serverUrlInput);
    if (!result.success) {
      toast({ title: result.error ?? "Server URL galat hai", variant: "destructive" });
      return;
    }
    toast({ title: result.value ? "✅ Sync server URL save ho gaya" : "Server URL hata diya gaya" });
  };

  const handleTestApiServer = async () => {
    const saveResult = saveApiServerUrl(serverUrlInput);
    if (!saveResult.success) {
      toast({ title: saveResult.error ?? "Server URL galat hai", variant: "destructive" });
      return;
    }
    setIsTestingServer(true);
    const result = await testApiConnection();
    setIsTestingServer(false);
    if (result.success) {
      toast({ title: "✅ Server connected! API sahi jawab de raha hai." });
    } else {
      toast({ title: result.error || "Server test fail hua", variant: "destructive" });
    }
  };

  const handleSaveRates = () => {
    // Validate: all rates must be positive integers
    for (const [anaj, valStr] of Object.entries(localRates)) {
      const v = parseInt(valStr, 10);
      if (isNaN(v) || v <= 0 || !Number.isInteger(v)) {
        toast({ title: `${anaj} ka rate galat hai — sirf poora positive number daalein (jaise 2, 3, 5)`, variant: "destructive" });
        return;
      }
    }
    const parsed: Record<string, number> = {};
    Object.keys(localRates).forEach((k) => { parsed[k] = parseInt(localRates[k], 10); });
    saveRates(parsed as any);
    toast({ title: "✅ Rates save ho gaye!" });
  };

  const handleSetupSync = async () => {
    if (!codeInput.trim()) {
      toast({ title: "Code darj karein", variant: "destructive" }); return;
    }
    setIsSettingUp(true);
    const result = await setupShop(codeInput.trim());
    setIsSettingUp(false);
    if (result.success) {
      setShowSetup(false); setCodeInput("");
      if (result.isNew) {
        toast({ title: `✅ Naya shop code bana: ${codeInput.trim().toUpperCase()}\nSabhi devices par yeh code dalein!` });
      } else {
        toast({ title: "✅ Connected! Data sync ho raha hai..." });
      }
    } else {
      toast({ title: result.error ?? "Kuch galat hua", variant: "destructive" });
    }
  };

  // ── Backup (export JSON). The file can be saved outside the app before uninstalling. ──
  const handleBackup = async () => {
    try {
      const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        shopCode: localStorage.getItem("chakki_shop_code") ?? "",
        apiServerUrl: localStorage.getItem("chakki_api_server_url") ?? "",
        records: JSON.parse(localStorage.getItem("chakki_records") ?? "[]"),
        customers: JSON.parse(localStorage.getItem("khata_customers") ?? "[]"),
        transactions: JSON.parse(localStorage.getItem("khata_transactions") ?? "[]"),
        settings: JSON.parse(localStorage.getItem("chakki_settings") ?? "{}"),
      };
      const filename = `chakki-backup-${new Date().toISOString().split("T")[0]}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const file = new File([blob], filename, { type: "application/json" });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: "Chakki Manager Backup", files: [file] });
        toast({ title: "✅ Backup share/save ke liye taiyar hai. File ko Downloads ya Drive mein save karein." });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast({ title: "✅ Backup file ban gayi. Downloads mein save hui hai ya nahi check kar lein." });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Backup nahi ban paaya", variant: "destructive" });
    }
  };

  // ── Restore (import JSON) ──
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || !Array.isArray(data.records) ||
            (data.customers !== undefined && !Array.isArray(data.customers)) ||
            (data.transactions !== undefined && !Array.isArray(data.transactions)) ||
            (data.settings !== undefined && (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)))) {
          toast({ title: "Yeh Chakki Manager backup JSON nahi hai", variant: "destructive" }); return;
        }
        if (!confirm("Restore karein? Current data replace ho jayega.")) return;
        const restored = [
          ["chakki_records", data.records],
          ["khata_customers", data.customers],
          ["khata_transactions", data.transactions],
          ["chakki_settings", data.settings],
        ] as const;
        for (const [key, value] of restored) {
          if (value === undefined) continue;
          const json = JSON.stringify(value);
          localStorage.setItem(key, json);
          window.dispatchEvent(new StorageEvent("storage", { key, newValue: json }));
        }
        if (typeof data.shopCode === "string" && data.shopCode.trim()) {
          localStorage.setItem("chakki_shop_code", data.shopCode.trim().toUpperCase());
          // Keep the restored local records and merge them to the cloud on next launch.
          localStorage.setItem("chakki_restore_pending_sync", "1");
        }
        if (typeof data.apiServerUrl === "string" && data.apiServerUrl.trim()) {
          localStorage.setItem("chakki_api_server_url", data.apiServerUrl.trim());
        }
        toast({ title: "✅ Data restore ho gaya! Page reload ho raha hai..." });
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        toast({ title: "File read karne mein error", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const syncStatusIcon =
    syncStatus === "syncing" ? <RefreshCw className="w-4 h-4 animate-spin text-blue-500" /> :
    syncStatus === "synced" ? <Check className="w-4 h-4 text-green-500" /> :
    syncStatus === "offline" ? <WifiOff className="w-4 h-4 text-amber-500" /> :
    syncStatus === "error" ? <AlertCircle className="w-4 h-4 text-red-500" /> :
    <Wifi className="w-4 h-4 text-muted-foreground" />;

  const syncStatusText =
    syncStatus === "syncing" ? "Sync ho raha hai..." :
    syncStatus === "synced" ? `Synced — ${lastSyncTime}` :
    syncStatus === "offline" ? "Offline mode (data saved locally)" :
    syncStatus === "error" ? (syncError || "Sync mein dikkat (retry karein)") :
    "Sync nahi hua";

  if (!isLoaded) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-4">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-xl">
          <SettingsIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground text-sm">सेटिंग्स — Rate aur app ki settings</p>
        </div>
      </div>

      {/* ── Dark Mode ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
            <div>
              <h3 className="font-bold">Dark Mode</h3>
              <p className="text-xs text-muted-foreground">Raat mein aankho ko aaram</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative w-12 h-6 rounded-full transition-colors ${isDark ? "bg-primary" : "bg-secondary border border-border"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDark ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      {/* ── Rates ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold">💰 Pisai Rates</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Sirf poore number daalein — jaise 2, 3, 5. Rate change karne ke baad purani bills same rahegi.</p>
        </div>

        {Object.keys(localRates).map((anaj) => {
          const val = localRates[anaj] ?? "";
          const num = parseInt(val, 10);
          const hasError = val !== "" && (isNaN(num) || num <= 0 || String(num) !== val.trim());
          return (
            <div key={anaj} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold text-base">{ANAJ_EMOJIS[anaj] ?? "🌾"} {anaj}</p>
                {ANAJ_HINDI[anaj] && <p className="text-xs text-muted-foreground">{ANAJ_HINDI[anaj]}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-muted-foreground">₹</span>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  value={val}
                  onChange={(e) => setLocalRates({ ...localRates, [anaj]: e.target.value })}
                  className={`h-12 text-lg font-bold w-24 ${hasError ? "border-destructive" : ""}`}
                />
                <span className="text-sm text-muted-foreground font-medium">/ KG</span>
              </div>
            </div>
          );
        })}

        <Button onClick={handleSaveRates} className="w-full h-12 text-base font-bold rounded-xl gap-2">
          <Save className="w-5 h-5" />
          Rates Save Karein
        </Button>
      </div>

      {/* ── Backup & Restore ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold">💾 Backup & Restore</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Data backup rakhein ya doosre phone par restore karein</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleBackup}
            variant="outline"
            className="h-14 rounded-xl flex-col gap-1 text-sm font-semibold"
          >
            <Download className="w-5 h-5 text-primary" />
            Backup Download
          </Button>
          <label className="cursor-pointer">
            <div className="h-14 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Upload className="w-5 h-5" />
              Restore
            </div>
            <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground bg-secondary/40 rounded-xl p-3">
          💡 App uninstall karne se phone ka local data mit sakta hai. Uninstall/update se pehle backup file ko Downloads ya Google Drive mein save karein. Restore ke baad, agar backup mein shop code hai, app data ko sync server se merge karne ki koshish karegi.
        </p>
      </div>

      {/* ── Sync API server URL ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <div>
          <h3 className="text-lg font-bold">🌐 Sync Server URL</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Website hosted sync server ko automatically use karti hai. Installed APK mein bhi isi shared server ka URL save karein, taaki dono devices ek hi database se sync hon. Server check ke liye Test Connection dabayein.
          </p>
        </div>
        <Input
          value={serverUrlInput}
          onChange={(e) => setServerUrlInput(e.target.value)}
          placeholder="https://chakki-manager-api.onrender.com"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          className="h-12 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleSaveApiServer} variant="outline" className="h-11 rounded-xl">
            Server URL Save
          </Button>
          <Button onClick={handleTestApiServer} disabled={isTestingServer} className="h-11 rounded-xl">
            {isTestingServer ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {isTestingServer ? "Testing..." : "Test Connection"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          URL save karne ke baad Test Connection dabayein. Test green aaye tabhi Multi-Device Sync connect karein.
        </p>
      </div>

      {/* ── Multi-Device Sync ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-bold">Multi-Device Sync</h3>
            <p className="text-xs text-muted-foreground">Kai phones par ek saath kaam karein</p>
          </div>
        </div>

        {shopCode ? (
          <div className="space-y-3">
            <div className="bg-secondary/40 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Shop Code</p>
              <p className="text-2xl font-bold tracking-widest mt-1">{shopCode}</p>
              <p className="text-xs text-muted-foreground mt-1">Dusre phone par yeh code dalein</p>
            </div>
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
              syncStatus === "synced" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
              syncStatus === "error" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" :
              "bg-secondary text-muted-foreground"
            }`}>
              {syncStatusIcon}
              <span className="min-w-0 break-words">{syncStatusText}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={syncNow} variant="outline" className="h-11 rounded-xl gap-2 text-sm">
                <RefreshCw className="w-4 h-4" /> Abhi Sync
              </Button>
              <Button
                onClick={() => {
                  if (confirm("Is device ko sync se alag karein? Data delete nahi hoga.")) {
                    disconnectShop();
                    toast({ title: "Device alag ho gaya. Data phone par hai." });
                  }
                }}
                variant="outline"
                className="h-11 rounded-xl gap-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <Unlink className="w-4 h-4" /> Disconnect
              </Button>
            </div>
          </div>
        ) : showSetup ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">4-8 character ka unique code banayein (ya kisi existing shop ka code dalein)</p>
            <Input
              placeholder="Jaise: KANHA123"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 8))}
              className="h-12 text-base font-bold tracking-widest text-center uppercase"
              maxLength={8}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleSetupSync} disabled={isSettingUp} className="h-11 rounded-xl">
                {isSettingUp ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                {isSettingUp ? "Connecting..." : "Connect"}
              </Button>
              <Button variant="outline" onClick={() => { setShowSetup(false); setCodeInput(""); }} className="h-11 rounded-xl">Raho</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Abhi sync setup nahi hai. Kai phones par kaam karne ke liye sync enable karein.</p>
            <Button onClick={() => setShowSetup(true)} className="w-full h-12 rounded-xl gap-2">
              <Link2 className="w-4 h-4" /> Sync Setup Karein
            </Button>
          </div>
        )}
      </div>

      {/* ── App Info ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-lg font-bold">📱 App Jankari</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">App Name</span>
            <span className="font-semibold">Kanha Chakki Register</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Version</span>
            <span className="font-semibold">2.2</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Developer</span>
            <span className="font-semibold">Kanha Kher 😎</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Default Rates</span>
            <span className="font-semibold">Gehu ₹2 · Makka ₹3 · Dal ₹5 · Besan ₹5 · Wata ₹2</span>
          </div>
        </div>
        <div className="bg-secondary/40 rounded-xl p-3 text-xs text-muted-foreground">
          💡 <strong>Install karne ke liye:</strong> Browser mein "Menu" → "Add to Home Screen" dabayein — app seedha phone par aa jayegi!
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
          <p className="text-sm font-bold text-primary">🏭 Chakki Manager</p>
          <p className="text-xs text-muted-foreground mt-1">Developed by <strong>Kanha Kher</strong></p>
        </div>
      </div>
    </div>
  );
}
