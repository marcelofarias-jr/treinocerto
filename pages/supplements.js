import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { todayFortaleza, addDays } from "../lib/dates";

// Lista de suplementos rastreados. Estruturado para crescer — hoje só creatina.
const SUPPLEMENTS = [
  { id: "creatina", label: "Creatina", hint: "5g por dia", emoji: "💪" },
];

const HISTORY_DAYS = 14;

export default function Supplements() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [takenByName, setTakenByName] = useState({}); // { name: Set<date> }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // name em processamento

  const today = todayFortaleza();

  useEffect(() => {
    if (!session) return;
    const from = addDays(today, -60);
    fetch(`/api/supplements?email=${session.user.email}&from=${from}&to=${today}`)
      .then((r) => r.json())
      .then((data) => {
        const map = {};
        (Array.isArray(data) ? data : []).forEach((row) => {
          if (!map[row.name]) map[row.name] = new Set();
          map[row.name].add(row.date);
        });
        setTakenByName(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, today]);

  if (status === "loading") return null;
  if (!session) {
    if (typeof window !== "undefined") router.push("/");
    return null;
  }

  async function toggleToday(name) {
    if (busy) return;
    setBusy(name);
    const isTaken = takenByName[name]?.has(today);

    // Atualização otimista
    setTakenByName((prev) => {
      const set = new Set(prev[name] || []);
      if (isTaken) set.delete(today);
      else set.add(today);
      return { ...prev, [name]: set };
    });

    try {
      if (isTaken) {
        await fetch(
          `/api/supplements?email=${session.user.email}&date=${today}&name=${encodeURIComponent(name)}`,
          { method: "DELETE" }
        );
      } else {
        await fetch("/api/supplements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: session.user.email, date: today, name }),
        });
      }
    } catch (_) {
      // Reverte em caso de erro
      setTakenByName((prev) => {
        const set = new Set(prev[name] || []);
        if (isTaken) set.add(today);
        else set.delete(today);
        return { ...prev, [name]: set };
      });
    } finally {
      setBusy(null);
    }
  }

  // Sequência de dias consecutivos tomados terminando hoje.
  function streakOf(name) {
    const set = takenByName[name];
    if (!set) return 0;
    let n = 0;
    let d = today;
    while (set.has(d)) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }

  const historyDates = Array.from({ length: HISTORY_DAYS }, (_, i) =>
    addDays(today, -(HISTORY_DAYS - 1 - i))
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <div className="mb-8">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Acompanhamento diário</p>
          <h1 className="font-heading font-black text-4xl uppercase text-white">Suplementos</h1>
        </div>

        {loading ? (
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl h-52 animate-pulse" />
        ) : (
          <div className="space-y-4">
            {SUPPLEMENTS.map((sup) => {
              const taken = takenByName[sup.id]?.has(today);
              const streak = streakOf(sup.id);
              const isBusy = busy === sup.id;
              return (
                <div key={sup.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0" aria-hidden>{sup.emoji}</span>
                      <div className="min-w-0">
                        <h2 className="font-heading font-black text-xl uppercase text-white leading-tight truncate">
                          {sup.label}
                        </h2>
                        <p className="text-zinc-500 text-xs">{sup.hint}</p>
                      </div>
                    </div>
                    {streak > 0 && (
                      <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/15 text-red-400 border border-red-900/60 text-xs font-bold uppercase tracking-wide">
                        🔥 {streak} {streak === 1 ? "dia" : "dias"}
                      </span>
                    )}
                  </div>

                  {/* Toggle de hoje */}
                  <button
                    onClick={() => toggleToday(sup.id)}
                    disabled={isBusy}
                    className={`w-full py-4 rounded-xl font-heading font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                      taken
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-[#232323] border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {taken ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Tomei hoje
                      </>
                    ) : (
                      "Marcar como tomado hoje"
                    )}
                  </button>

                  {/* Histórico dos últimos dias */}
                  <div className="mt-5">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                      Últimos {HISTORY_DAYS} dias
                    </p>
                    <div className="flex gap-1.5 justify-between">
                      {historyDates.map((d) => {
                        const on = takenByName[sup.id]?.has(d);
                        const isToday = d === today;
                        const dayNum = parseInt(d.slice(8, 10), 10);
                        return (
                          <div key={d} className="flex flex-col items-center gap-1 min-w-0">
                            <div
                              title={d}
                              className={`w-full aspect-square min-w-[16px] rounded-md flex items-center justify-center text-[9px] font-bold ${
                                on
                                  ? "bg-red-600 text-white"
                                  : "bg-[#232323] border border-zinc-800 text-zinc-600"
                              } ${isToday ? "ring-2 ring-red-400/60" : ""}`}
                            >
                              {on && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-[9px] ${isToday ? "text-red-400 font-bold" : "text-zinc-600"}`}>
                              {dayNum}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
