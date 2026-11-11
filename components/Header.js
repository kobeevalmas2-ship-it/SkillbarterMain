"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { useWallet } from "@/components/WalletContext";
import { useLanguage } from "./LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

const LINKS = [["/", "ГЛАВНАЯ"], ["/find", "НАЙТИ ПОМОЩЬ"], ["/services", "МОИ УСЛУГИ"], ["/favorites", "ИЗБРАННОЕ"], ["/wallet", "КОШЕЛЁК"]];

export default function Header() {
  const { t } = useLanguage();
  const path = usePathname();
  const { user, ready, logout } = useAuth();
  const { balance, ready: walletReady } = useWallet();
  const links = (cls) =>
    LINKS.map(([href, label]) => (
      <Link key={href} href={href} className={`px-3 py-2 whitespace-nowrap ${path === href ? "nav-on" : ""} ${cls}`}>{t(label)}</Link>
    ));
  return (
    <header className="sticky top-0 z-20 bg-bg border-b-2 border-ink">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 min-h-16 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <Link href="/" className="flex items-center gap-2 font-head font-extrabold text-base sm:text-xl">
          <span className="hidden sm:grid w-9 h-9 bg-y border-2 border-ink place-items-center text-k">⇄</span>
          <span>SKILL<span className="text-acc">BARTER</span></span>
        </Link>
        <div className={`ml-auto flex items-center gap-3 ${user ? "order-3 basis-full justify-end sm:order-none sm:basis-auto" : ""}`}>
          {user && <Link href="/wallet" aria-label={t("Открыть кошелёк")} className="bg-y text-k border-2 border-ink px-2 sm:px-3 py-1.5 font-mono font-bold text-xs sm:text-sm whitespace-nowrap shs">◷ {walletReady ? balance : "…"} {t("мин")}</Link>}
          {!ready ? null : user ? (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="hidden sm:grid w-9 h-9 bg-pu text-k border-2 border-ink place-items-center text-xs font-bold" title={user.name}>{user.name.slice(0, 2).toUpperCase()}</span>
              <span className="hidden 2xl:inline max-w-[100px] truncate">{user.name}</span>
              <button className="text-xs underline underline-offset-2" onClick={logout}>{t("Выйти")}</button>
            </div>
          ) : <Link href="/login" className="btn bg-y !px-3 !py-1.5 text-sm">{t("Войти")}</Link>}
        </div>
        <div className={user ? "ml-auto sm:ml-0" : ""}><LanguageSwitcher /></div>
      </div>
      <nav className="max-w-6xl mx-auto flex gap-1 px-4 pb-2 text-xs font-semibold overflow-x-auto">{links("")}</nav>
    </header>
  );
}
