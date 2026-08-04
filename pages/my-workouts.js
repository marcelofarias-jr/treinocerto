import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatConfigs, muscleGroupLabels } from "../lib/workoutConfig";

export default function MyWorkouts() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [workouts, setWorkouts] = useState([]);
  const [sessionCounts, setSessionCounts] = useState({});
  const [dayCounts, setDayCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  function toggleExpanded(id) {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch(`/api/workouts?email=${session.user.email}`).then((r) => r.json()),
      fetch(`/api/sessions?email=${session.user.email}`).then((r) => r.json()),
    ])
      .then(([workoutsData, sessionsData]) => {
        setWorkouts(Array.isArray(workoutsData) ? workoutsData : []);
        const counts = {};
        const dCounts = {};
        (Array.isArray(sessionsData) ? sessionsData : []).forEach((s) => {
          if (s.workoutId == null) return;
          counts[s.workoutId] = (counts[s.workoutId] || 0) + 1;
          if (s.dayId != null) {
            const k = `${s.workoutId}_${s.dayId}`;
            dCounts[k] = (dCounts[k] || 0) + 1;
          }
        });
        setSessionCounts(counts);
        setDayCounts(dCounts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  if (status === "loading") return null;
  if (!session) {
    if (typeof window !== "undefined") router.push("/");
    return null;
  }

  async function deleteWorkout() {
    await fetch("/api/workouts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: confirmDeleteId }),
    });
    setWorkouts(workouts.filter((w) => w.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  }

  async function setActive(id) {
    setWorkouts((ws) => ws.map((w) => ({ ...w, isActive: w.id === id })));
    await fetch("/api/workouts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email: session.user.email }),
    });
  }

  // Ativo efetivo: o marcado ou, na ausência, o mais recente (último criado).
  const activeId =
    workouts.find((w) => w.isActive)?.id ?? workouts[workouts.length - 1]?.id;

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Seus planos</p>
            <h1 className="font-heading font-black text-4xl uppercase text-white">Meus Treinos</h1>
          </div>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors"
          >
            + Novo
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl h-40 animate-pulse" />
            ))}
          </div>
        ) : workouts.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-10 text-center">
            <p className="text-zinc-300 mb-5">Nenhum treino salvo ainda.</p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors"
            >
              Criar meu treino
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {workouts.map((workout) => {
              const formatConfig = formatConfigs[workout.format]
              const isOpen = !!expandedIds[workout.id]
              const doneCount = sessionCounts[workout.id] || 0
              const isActive = workout.id === activeId
              return (
                <div key={workout.id} className={`bg-[#1a1a1a] border rounded-2xl overflow-hidden ${isActive ? 'border-red-600' : 'border-zinc-800'}`}>
                  {/* Header clicável */}
                  <button
                    onClick={() => toggleExpanded(workout.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5">
                          {new Date(workout.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                        <div className="flex items-center gap-2">
                          <h2 className="font-heading font-black text-xl uppercase text-white leading-tight">
                            {formatConfig?.name || workout.format}
                          </h2>
                          {isActive && (
                            <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded flex-shrink-0">
                              Ativo
                            </span>
                          )}
                        </div>
                        {workout.days && (
                          <p className="text-zinc-400 text-xs mt-0.5">
                            {workout.days.length} {workout.days.length === 1 ? 'dia' : 'dias'}
                            {' · '}
                            {workout.days.reduce((t, day) =>
                              t + day.exercises.reduce((dt, mg) =>
                                dt + mg.exercises.reduce((mt, ex) =>
                                  mt + (typeof ex === 'object' && ex.series ? parseInt(ex.series) : 3), 0), 0), 0)
                            } séries
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${
                          doneCount > 0
                            ? 'bg-red-600/15 text-red-400 border border-red-900/60'
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                        }`}
                        title="Sessões já realizadas deste treino"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {doneCount} {doneCount === 1 ? 'sessão' : 'sessões'}
                      </span>
                      <svg
                        className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Conteúdo expansível */}
                  {isOpen && (
                    <div className="border-t border-zinc-800 px-5 pb-5 pt-4">
                      {/* Ações */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {isActive ? (
                          <span className="px-4 py-2 border border-red-900/60 bg-red-600/15 text-red-400 text-xs font-semibold uppercase tracking-wide rounded-lg flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            Treino ativo
                          </span>
                        ) : (
                          <button
                            onClick={() => setActive(workout.id)}
                            className="px-4 py-2 border border-zinc-700 hover:border-red-600 text-zinc-300 hover:text-red-400 text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors"
                          >
                            Definir como ativo
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/dashboard?edit=${workout.id}`)}
                          className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(workout.id)}
                          className="px-4 py-2 border border-red-900 hover:border-red-600 text-red-500 hover:text-red-400 text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors"
                        >
                          Deletar
                        </button>
                      </div>

                      {/* Detalhes */}
                      {workout.days ? (
                        <div className="space-y-3">
                          {workout.days.map(day => {
                            const exCount = day.exercises.reduce((a, mg) => a + mg.exercises.length, 0)
                            const seriesCount = day.exercises.reduce((dt, mg) =>
                              dt + mg.exercises.reduce((mt, ex) =>
                                mt + (typeof ex === 'object' && ex.series ? parseInt(ex.series) : 3), 0), 0)
                            const dayDone = dayCounts[`${workout.id}_${day.dayId}`] || 0
                            return (
                            <div key={day.dayId} className="bg-[#232323] rounded-xl p-4 border border-zinc-800">
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-red-500 truncate">{day.label}</p>
                                  <span
                                    className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                      dayDone > 0
                                        ? 'bg-red-600/15 text-red-400 border border-red-900/60'
                                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                                    }`}
                                    title="Vezes que você já fez este dia"
                                  >
                                    {dayDone}× feito
                                  </span>
                                </div>
                                <span className="text-xs text-zinc-500 flex-shrink-0">{exCount} ex · {seriesCount} séries</span>
                              </div>
                              <div className="space-y-2">
                                {day.exercises.map((mg, gi) => (
                                  <div key={gi}>
                                    <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">
                                      {muscleGroupLabels[mg.muscleGroup] || mg.muscleGroup}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {mg.exercises.map(ex => {
                                        const item = typeof ex === "string" ? { name: ex } : ex;
                                        const series = item.series ? parseInt(item.series) : 3;
                                        return (
                                          <span key={item.name} className="px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded text-xs">
                                            {item.name}
                                            {item.observacoes && (
                                              <span className="text-zinc-500 ml-1">· {item.observacoes}</span>
                                            )}
                                            <span className="text-zinc-600 ml-1">· {series}×</span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )})}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(workout.exercises || []).map(ex => (
                            <span key={ex} className="px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded text-xs">{ex}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-heading font-black text-xl uppercase text-white mb-1">Deletar treino</h3>
            <p className="text-zinc-300 text-sm mb-6">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={deleteWorkout}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest text-sm rounded-xl transition-colors"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
