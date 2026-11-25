"use client";

import AvailabilityEditor from "@/components/AvailabilityEditor";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useRequests } from "@/components/RequestsContext";
import { useWallet } from "@/components/WalletContext";
import { WorkflowGate } from "@/components/RequestUI";

export default function AvailabilityPage() {
  const { t } = useLanguage();
  const { user, ready: authReady } = useAuth();
  const { ready, error, refresh } = useRequests();
  const { ready: walletReady, error: walletError, refresh: refreshWallet } = useWallet();

  return <WorkflowGate user={user} authReady={authReady} ready={ready && walletReady}
    error={error || walletError} refresh={() => { refresh(); refreshWallet(); }} next="/availability">
    <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <span className="lbl bg-y text-k border-2 border-ink px-2 py-1 inline-block">{t("Ваш календарь для обменов")}</span>
      <h1 className="font-head font-extrabold text-4xl md:text-6xl tracking-tight mt-4">{t("Свободное время")}</h1>
      <p className="max-w-3xl mt-4 text-ink/70">{t("Отметьте, когда готовы проводить занятия. Это общий календарь для всех ваших услуг: участники смогут выбрать подходящее время при отправке заявки.")}</p>
      {user && <AvailabilityEditor key={user.email} />}
    </section>
  </WorkflowGate>;
}
