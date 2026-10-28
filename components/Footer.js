export default function Footer() {
  return (
    <footer className="bg-y text-k border-t-2 border-ink mt-8">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap gap-4 justify-between items-center text-sm">
        <span className="flex items-center gap-2 font-head font-extrabold">
          <span className="w-8 h-8 bg-white border-2 border-ink grid place-items-center">⇄</span>SKILLBARTER
        </span>
        <span>Знания ценнее, когда ими делятся. © 2026 SkillBarter</span>
        <span className="font-semibold">Один час помощи = один час возможностей</span>
      </div>
    </footer>
  );
}
