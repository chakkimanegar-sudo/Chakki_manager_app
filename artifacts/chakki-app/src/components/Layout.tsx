import { Link, useLocation } from "wouter";
import { Home, PlusCircle, List, BookOpen, Settings, Wheat, BarChart3, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden">
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-xl">
              <Wheat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">Chakki Manager</h1>
              <p className="text-white/70 text-[10px] mt-0.5">Kanha Chakki Register</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="bg-white/20 hover:bg-white/30 active:bg-white/40 p-2 rounded-xl transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 p-4">
        {children}

        <footer className="mt-8 mb-2 pt-4 border-t border-border/60 text-center">
          <p className="text-xs font-bold text-primary">🏭 Chakki Manager</p>
          <p className="text-[10px] text-muted-foreground mt-1">Developed by <span className="font-semibold text-foreground">Kanha Kher</span> 😎</p>
        </footer>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-1 py-2 pb-safe z-20 flex justify-around items-center max-w-md mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${location === "/" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px] font-medium">Home</span>
        </Link>

        <Link
          href="/records"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${location.startsWith("/records") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <List className="w-5 h-5" />
          <span className="text-[9px] font-medium">Records</span>
        </Link>

        {/* Center FAB */}
        <Link href="/add" className="flex flex-col items-center gap-0.5 px-2 -mt-5">
          <div className="bg-primary text-primary-foreground p-4 rounded-full shadow-lg shadow-primary/30 transform transition active:scale-95 hover:brightness-110">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-[9px] text-primary font-bold mt-0.5">Naya</span>
        </Link>

        <Link
          href="/khata"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${location.startsWith("/khata") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[9px] font-medium">Khata</span>
        </Link>

        <Link
          href="/reports"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${location.startsWith("/reports") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[9px] font-medium">Reports</span>
        </Link>

        <Link
          href="/settings"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${location.startsWith("/settings") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[9px] font-medium">Settings</span>
        </Link>
      </nav>
    </div>
  );
}
