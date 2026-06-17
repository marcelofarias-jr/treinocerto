const FORMATS = [
  {
    id: 'fullbody',
    code: 'FB',
    num: '01',
    name: 'FULL BODY',
    desc: 'Corpo inteiro em cada sessão. Ideal para iniciantes e quem treina 2–3x por semana.',
    freq: '3X / SEMANA',
    days: ['DIA A', 'DIA B', 'DIA C'],
  },
  {
    id: 'upper_lower',
    code: 'UL',
    num: '02',
    name: 'UPPER / LOWER',
    desc: 'Alterna superiores e inferiores. Equilíbrio entre volume e recuperação.',
    freq: '4X / SEMANA',
    days: ['UPPER A', 'LOWER A', 'UPPER B', 'LOWER B'],
  },
  {
    id: 'ppl',
    code: 'PPL',
    num: '03',
    name: 'PUSH / PULL / LEGS',
    desc: 'Empurrar, puxar e pernas. Máximo volume por grupo muscular.',
    freq: '5–6X / SEMANA',
    days: ['PUSH', 'PULL', 'LEGS'],
  },
]

export default function FormatSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {FORMATS.map(f => {
        const active = value === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`text-left p-5 rounded-xl border transition-all ${
              active
                ? 'border-red-600 bg-red-950/20'
                : 'border-zinc-800 bg-[#1a1a1a] hover:border-zinc-600'
            }`}
          >
            <div className="flex justify-between items-start mb-5">
              <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs font-mono rounded">
                {f.code}
              </span>
              <span className="font-heading font-black text-5xl text-zinc-800 leading-none select-none">
                {f.num}
              </span>
            </div>

            <p className="font-heading font-black text-white text-xl uppercase tracking-wide mb-2">
              {f.name}
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed mb-5">{f.desc}</p>

            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-xs uppercase tracking-widest">{f.freq}</span>
                <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex flex-wrap gap-1">
                {f.days.map(d => (
                  <span key={d} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
