"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

const LINKS = [["/", "ГЛАВНАЯ"], ["/find", "НАЙТИ ПОМОЩЬ"], ["/services", "МОИ УСЛУГИ"]];

export default function Header() {
  const path = usePathname();
  const { user, ready, logout } = useAuth();
  const links = (cls) =>
    LINKS.map(([href, label]) => (
      <Link key={href} href={href} className={`px-3 py-2 whitespace-nowrap ${path === href ? "nav-on" : ""} ${cls}`}>{label}</Link>
    ));
  return (
    <header className="sticky top-0 z-20 bg-bg border-b-2 border-ink">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-head font-extrabold text-xl">
          <span className="w-9 h-9 bg-y border-2 border-ink grid place-items-center text-k">⇄</span>
          <span>SKILL<span className="text-acc">BARTER</span></span>
        </Link>
        <nav className="hidden md:flex gap-1 ml-4 text-sm font-semibold">{links("")}</nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="bg-y text-k border-2 border-ink px-3 py-1.5 font-mono font-bold text-sm shs">☀ 240 мин</span>
          {!ready ? null : user ? (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="w-9 h-9 bg-pu text-k border-2 border-ink grid place-items-center text-xs font-bold">{user.name.slice(0, 2).toUpperCase()}</span>
              <span className="hidden sm:inline">{user.name}</span>
              <button className="text-xs underline underline-offset-2" onClick={logout}>Шығу</button>
            </div>
          ) : <Link href="/login" className="btn bg-y !px-3 !py-1.5 text-sm">Кіру</Link>}
        </div>
      </div>
      <nav className="md:hidden flex gap-1 px-4 pb-2 text-xs font-semibold overflow-x-auto">{links("")}</nav>
    </header>
  );
}
