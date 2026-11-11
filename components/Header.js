"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { useWallet } from "@/components/WalletContext";
import { useLanguage } from "./LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeSwitcher from "./ThemeSwitcher";
import { useRequests } from "./RequestsContext";

const LINKS = [["/", "ГЛАВНАЯ"], ["/find", "НАЙТИ ПОМОЩЬ"], ["/services", "МОИ УСЛУГИ"], ["/favorites", "ИЗБРАННОЕ"], ["/wallet", "КОШЕЛЁК"]];

export default function Header() {
  const { t } = useLanguage();
  const path = usePathname();
  const { user, ready, logout } = useAuth();
  const { balance, ready: walletReady } = useWallet();
  const { unreadCount, unreadMessages } = useRequests();
  const navigation = user ? [["/day", "МОЙ ДЕНЬ"], ["/requests", "ЗАЯВКИ"], ...LINKS] : LINKS;
  const links = (cls) =>
    navigation.map(([href, label]) => (
      <Link key={href} href={href} className={`shrink-0 px-3 py-2 whitespace-nowrap ${path === href || (href === "/requests" && path.startsWith("/requests/")) ? "nav-on" : ""} ${cls}`}>{t(label)}{href === "/requests" && unreadMessages > 0 && <span className="ml-1 bg-b text-white px-1.5" aria-label={t("Непрочитанных сообщений: {count}", { count: unreadMessages })}>{unreadMessages > 99 ? "99+" : unreadMessages}</span>}</Link>
    ));
  return (
    <header className="sticky top-0 z-20 bg-bg border-b-2 border-ink">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 lg:py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 lg:flex lg:min-h-16 lg:gap-3">
        <Link href="/" className="row-start-1 col-start-1 min-w-0 lg:shrink-0 flex items-center gap-2 font-head font-extrabold text-sm sm:text-xl">
          <span className="hidden sm:grid w-9 h-9 bg-y border-2 border-ink place-items-center text-k">⇄</span>
          <span className="truncate">SKILL<span className="text-acc">BARTER</span></span>
        </Link>
        <div className="row-start-2 col-start-1 w-[104px] sm:w-[138px] lg:w-auto lg:shrink-0 [&_label]:max-w-full [&_select]:w-full [&_select]:min-h-9 lg:[&_select]:min-h-10"><ThemeSwitcher /></div>
        <div className="row-start-2 col-start-2 min-w-0 flex items-center justify-end gap-1 sm:gap-2 lg:ml-auto">
          {user && <Link href="/notifications" aria-label={t("Уведомления: {count} непрочитанных", { count: unreadCount })} title={t("Уведомления")} className="relative shrink-0 w-8 h-9 sm:w-10 sm:h-10 border-2 border-ink bg-card grid place-items-center">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4M12 2V1" /></svg>
            {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-4 px-0.5 border border-ink bg-b text-white text-[9px] font-bold leading-4 text-center">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </Link>}
          {user && <Link href="/wallet" aria-label={t("Открыть кошелёк")} title={`${walletReady ? balance : "…"} ${t("мин")}`} className="flex items-center justify-center gap-1 shrink-0 w-[60px] sm:w-auto sm:max-w-[140px] h-9 sm:h-10 bg-y text-k border-2 border-ink px-1 sm:px-3 font-mono font-bold text-xs sm:text-sm whitespace-nowrap shs"><span className="hidden md:inline" aria-hidden="true">◷</span><span className="min-w-0 truncate">{walletReady ? balance : "…"}</span><span className="shrink-0">{t("мин")}</span></Link>}
          {!ready ? null : user ? (
            <div className="flex shrink-0 items-center gap-1 sm:gap-2 text-sm font-semibold">
              <Link href="/profile" aria-label={t("Мой профиль")} className="grid shrink-0 w-8 h-9 sm:w-9 sm:h-10 overflow-hidden bg-pu text-k border-2 border-ink place-items-center text-xs font-bold" title={user.name}>{user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.slice(0, 2).toUpperCase()}</Link>
              <span className="hidden 2xl:inline max-w-[100px] truncate">{user.name}</span>
              <Link href="/profile" className="hidden sm:inline text-xs underline underline-offset-2">{t("Профиль")}</Link>
              <button type="button" aria-label={t("Выйти")} title={t("Выйти")} className="grid place-items-center shrink-0 w-7 h-9 sm:w-auto sm:h-auto text-xs sm:underline underline-offset-2" onClick={logout}>
                <svg className="sm:hidden" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h12" /></svg>
                <span className="hidden sm:inline">{t("Выйти")}</span>
              </button>
            </div>
          ) : <Link href="/login" className="btn bg-y !px-3 !py-1.5 text-sm">{t("Войти")}</Link>}
        </div>
        <div className="row-start-1 col-start-2 justify-self-end lg:shrink-0 [&_button]:min-h-8 lg:[&_button]:min-h-9"><LanguageSwitcher /></div>
      </div>
      <nav className="max-w-6xl mx-auto min-w-0 flex gap-1 px-3 sm:px-4 pb-1 text-[11px] sm:text-xs font-semibold overflow-x-auto">{links("")}</nav>
    </header>
  );
}
