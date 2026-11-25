"use client";

import { useLanguage } from "./LanguageContext";

function SkeletonLine({ className = "" }) {
  return <span className={`skeleton block h-4 ${className}`} />;
}

function CardSkeleton() {
  return <div className="border-2 border-ink bg-card shs overflow-hidden">
    <div className="skeleton h-36 border-b-2 border-ink" />
    <div className="p-5 space-y-4"><SkeletonLine className="w-1/3 h-3" /><SkeletonLine className="w-4/5 h-6" />
      <SkeletonLine /><SkeletonLine className="w-2/3" />
      <div className="flex gap-2 pt-2"><SkeletonLine className="w-20 h-6" /><SkeletonLine className="w-24 h-6" /></div>
      <div className="pt-4 border-t-2 border-ink flex gap-3"><SkeletonLine className="w-9 h-9" /><SkeletonLine className="w-1/2 mt-2" /></div>
    </div>
  </div>;
}

export function OfferGridSkeleton({ label, count = 6 }) {
  return <LoadingState variant="cards" label={label} count={count} />;
}

export default function LoadingState({ variant = "page", label, count = 6 }) {
  const { t } = useLanguage();
  const message = label ? t(label) : t("Загружаем…");
  return <div role="status" aria-live="polite" className="w-full">
    <p className="text-sm text-ink/70 flex items-center gap-2 mb-5">
      <span className="inline-block w-3 h-3 border-2 border-ink bg-y" aria-hidden="true" />{message}
    </p>
    <div aria-hidden="true">
      {variant === "compact" ? <div className="space-y-4"><SkeletonLine className="w-3/4" /><SkeletonLine /><SkeletonLine className="w-2/3 h-9" /></div> : variant === "cards" ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
        {Array.from({ length: Math.max(1, Math.min(count, 12)) }, (_, index) => <CardSkeleton key={index} />)}
      </div> : variant === "dashboard" ? <>
        <div className="grid sm:grid-cols-3 gap-5">{[0, 1, 2].map((index) => <div key={index} className="border-2 border-ink bg-card p-5 space-y-5"><SkeletonLine className="w-2/3" /><SkeletonLine className="w-1/2 h-10" /><SkeletonLine /></div>)}</div>
        <div className="border-2 border-ink bg-card p-6 space-y-5 mt-7"><SkeletonLine className="w-1/3 h-6" /><SkeletonLine /><SkeletonLine className="w-3/4" /><SkeletonLine /></div>
      </> : variant === "detail" ? <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-7">
        <div className="border-2 border-ink bg-card p-6 space-y-5"><div className="skeleton h-48" /><SkeletonLine className="w-2/3 h-8" /><SkeletonLine /><SkeletonLine /><SkeletonLine className="w-4/5" /></div>
        <div className="border-2 border-ink bg-card p-6 space-y-5 self-start"><SkeletonLine className="w-3/4 h-7" /><SkeletonLine /><SkeletonLine className="h-10" /><SkeletonLine className="h-10" /></div>
      </div> : <div className="border-2 border-ink bg-card p-6 space-y-5"><SkeletonLine className="w-1/2 max-w-sm h-8" /><SkeletonLine /><SkeletonLine className="w-4/5" /><SkeletonLine className="w-2/3" /></div>}
    </div>
  </div>;
}
