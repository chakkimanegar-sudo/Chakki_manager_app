import { Link } from "wouter";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center gap-4">
      <div className="text-6xl">🌾</div>
      <h1 className="text-2xl font-bold">Page nahi mila</h1>
      <p className="text-muted-foreground text-sm">Yeh page exist nahi karta.</p>
      <Link href="/" className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm mt-2">
        <Home className="w-4 h-4" /> Home par jaein
      </Link>
    </div>
  );
}
