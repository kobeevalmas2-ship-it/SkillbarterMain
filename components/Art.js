import { CATS } from "./data";

// Цветная заглушка вместо фото (замените на <Image /> со своими фото)
export default function Art({ cat, className = "h-40" }) {
  const x = CATS.find((k) => k[0] === cat) || CATS[5];
  return (
    <div className={`relative ${className} ${x[2]} border-b-2 border-ink overflow-hidden`}>
      <i className={`absolute left-5 top-6 w-16 h-16 rounded-full border-2 border-ink ${x[3][0]}`} />
      <i className={`absolute left-[42%] top-12 w-20 h-20 border-2 border-ink rotate-12 ${x[3][1]}`} />
      <i className={`absolute right-5 bottom-3 w-14 h-14 border-2 border-ink ${x[3][2]}`} style={{ clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />
    </div>
  );
}
