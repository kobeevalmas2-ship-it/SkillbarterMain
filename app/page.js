import Link from "next/link";
import Art from "@/components/Art";
import OpenModalButton from "@/components/OpenModalButton";
import { CATS } from "@/components/data";

export default function Home() {
  return (
    <>
      <section className="bg-lb text-k border-b-2 border-ink">
        <div className="max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="lbl bg-y border-2 border-ink px-2 py-1 inline-block">Знания ↔ Время</span>
            <h1 className="font-head font-extrabold text-5xl md:text-7xl leading-[.95] tracking-tight mt-6">
              Умеешь что-то? <span className="text-b">Обменяй на новое.</span>
            </h1>
            <p className="mt-6 max-w-md text-black/70">Делитесь тем, что умеете, и учитесь у других. Здесь за помощь благодарят временем, а не деньгами.</p>
            <div className="flex gap-3 mt-8 flex-wrap">
              <Link href="/find" className="btn bg-b text-white">Найти помощь ↗</Link>
              <OpenModalButton className="bg-white">Предложить навык</OpenModalButton>
            </div>
            <div className="flex items-center gap-3 mt-10">
              <span className="flex">
                <i className="w-7 h-7 bg-pu border-2 border-ink grid place-items-center not-italic lbl">А</i>
                <i className="w-7 h-7 bg-co border-2 border-ink -ml-0.5 grid place-items-center not-italic lbl">С</i>
                <i className="w-7 h-7 bg-lb border-2 border-ink -ml-0.5 grid place-items-center not-italic lbl">Б</i>
              </span>
              <span className="lbl">Сообщество, где каждый может быть полезен</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md aspect-square" aria-hidden="true">
            <div className="absolute inset-6 bg-b border-2 border-ink sh rotate-2 overflow-hidden">
              <div className="absolute left-[12%] top-[14%] w-[76%] h-[52%] bg-[#1b1b22] border-2 border-ink p-3 space-y-2">
                <i className="block h-2 w-3/5 bg-co" /><i className="block h-2 w-4/5 bg-y ml-4" /><i className="block h-2 w-2/5 bg-lb ml-4" /><i className="block h-2 w-3/5 bg-y ml-8" /><i className="block h-2 w-1/3 bg-co" />
              </div>
              <div className="absolute left-[6%] right-[6%] top-[64%] h-[18%] bg-[#2a2a33] border-2 border-ink -skew-x-6" />
              <div className="absolute right-4 bottom-4 w-14 h-20 bg-co border-2 border-ink rotate-6" />
              <div className="absolute left-4 top-3 w-10 h-10 rounded-full bg-y border-2 border-ink" />
            </div>
            <span className="absolute left-2 top-2 lbl bg-y border-2 border-ink px-2 py-1 -rotate-3">Skills ↗ Time</span>
            <span className="absolute right-0 top-[18%] bg-card text-ink border-2 border-ink px-3 py-2 shs rotate-3 text-sm"><b className="font-head">Английский язык</b><br /><span className="lbl !font-medium">Учимся вместе</span></span>
            <span className="absolute left-0 bottom-[22%] bg-card text-ink border-2 border-ink px-3 py-2 shs -rotate-2 text-sm"><b className="font-head">Программирование</b><br /><span className="lbl !font-medium">Делимся опытом</span></span>
            <span className="absolute left-[30%] bottom-2 bg-y text-k border-2 border-ink px-3 py-2 shs rotate-2 text-sm"><b className="font-head">+60 минут</b><br /><span className="lbl !font-medium">на вашем балансе</span></span>
            <span className="absolute right-0 bottom-[12%] lbl bg-b text-white border-2 border-ink px-2 py-1 -rotate-3">01 / Обмен знаниями</span>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="font-head font-extrabold text-4xl md:text-5xl tracking-tight">Чему хотите научиться?</h2>
        <p className="mt-2 text-ink/60">Найдите человека, который поможет вам сделать следующий шаг.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {CATS.map((c) => (
            <Link key={c[0]} href={`/find?cat=${encodeURIComponent(c[0])}`} className="block bg-card text-ink border-2 border-ink sh">
              <Art cat={c[0]} />
              <div className="flex justify-between items-center p-5">
                <div>
                  <div className="font-head font-extrabold text-2xl">{c[0]}</div>
                  <div className="lbl !font-medium mt-1 normal-case">{c[1]}</div>
                </div>
                <span className="w-9 h-9 bg-y text-k border-2 border-ink grid place-items-center font-bold">↗</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
