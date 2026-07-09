import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import FormatSelector from "../components/FormatSelector";
import WorkoutGroupSelector from "../components/WorkoutGroupSelector";
import WorkoutArranger from "../components/WorkoutArranger";
import Toast from "../components/Toast";
import { formatConfigs } from "../lib/workoutConfig";

function normalizeExercise(item) {
  return typeof item === "string"
    ? { name: item, carga: "", repeticoes: "", observacoes: "" }
    : item;
}

const STEPS = [
  { n: 1, label: "Formato" },
  { n: 2, label: "Grupos e exercícios" },
  { n: 3, label: "Ordem e cargas" },
];

function StepIndicator({ step, onGoto }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {STEPS.map((s, i) => {
        const isActive = step === s.n;
        const isDone = step > s.n;
        return (
          <div key={s.n} className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => (s.n < step ? onGoto(s.n) : null)}
              disabled={s.n > step}
              className={`flex items-center gap-2 min-w-0 ${s.n < step ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black flex-shrink-0 transition-colors ${
                  isActive
                    ? "bg-red-600 text-white"
                    : isDone
                    ? "bg-red-600/30 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  s.n
                )}
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-widest truncate hidden sm:inline ${
                  isActive ? "text-white" : "text-zinc-500"
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && <span className="w-4 sm:w-8 h-px bg-zinc-800 flex-shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { edit } = router.query;
  const [step, setStep] = useState(1);
  const [format, setFormat] = useState("fullbody");
  // Dados guardados por formato, para não perder as seleções ao voltar ao
  // passo 1 ou alternar entre formatos.
  const [musclesByFormat, setMusclesByFormat] = useState({}); // { [format]: { [dayId]: mg[] } }
  const [exercisesByFormat, setExercisesByFormat] = useState({}); // { [format]: { [key]: item[] } }
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!edit);
  const [workoutId, setWorkoutId] = useState(null);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (edit && session) {
      fetch(`/api/workouts?email=${session.user.email}`)
        .then((r) => r.json())
        .then((workouts) => {
          const workout = workouts.find((w) => w.id === parseInt(edit));
          if (workout) {
            setFormat(workout.format);
            if (Array.isArray(workout.days)) {
              const musclesByDay = {};
              const exercisesByDay = {};
              workout.days.forEach(day => {
                musclesByDay[day.dayId] = day.exercises.map(e => e.muscleGroup);
                day.exercises.forEach(e => {
                  const key = `${day.dayId}_${e.muscleGroup}`;
                  exercisesByDay[key] = e.exercises.map(normalizeExercise);
                });
              });
              setMusclesByFormat({ [workout.format]: musclesByDay });
              setExercisesByFormat({ [workout.format]: exercisesByDay });
            } else {
              setExercisesByFormat({ [workout.format]: { "1": (workout.exercises || []).map(normalizeExercise) } });
            }
            setWorkoutId(workout.id);
          }
          setLoading(false);
        });
    }
  }, [edit, session]);

  if (status === "loading") return null;
  if (!session) {
    if (typeof window !== "undefined") router.push("/");
    return null;
  }

  // Visão do formato atualmente selecionado.
  const selectedMusclesByDay = musclesByFormat[format] || {};
  const selectedExercisesByDay = exercisesByFormat[format] || {};

  const setMusclesByDay = (next) =>
    setMusclesByFormat((prev) => ({ ...prev, [format]: next }));
  const setExercisesByDay = (next) =>
    setExercisesByFormat((prev) => ({ ...prev, [format]: next }));

  const totalExercises = Object.values(selectedExercisesByDay).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  async function save() {
    setSaving(true);
    const config = formatConfigs[format];
    const days = config.days.map(day => {
      const muscleGroups = selectedMusclesByDay[day.id] || [];
      const exercises = muscleGroups
        .map(mg => ({
          muscleGroup: mg,
          exercises: selectedExercisesByDay[`${day.id}_${mg}`] || []
        }))
        .filter(g => g.exercises.length > 0);
      return { dayId: day.id, label: day.label, exercises };
    });

    const payload = { format, days, user: session.user };

    if (workoutId) {
      await fetch("/api/workouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workoutId, ...payload }),
      });
      setToast({ message: "Treino atualizado com sucesso!", type: "success" });
    } else {
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setToast({ message: "Treino salvo com sucesso!", type: "success" });
    }

    setSaving(false);
    setTimeout(() => router.push("/my-workouts"), 1200);
  }

  function resetForm() {
    setStep(1);
    setFormat("fullbody");
    setMusclesByFormat({});
    setExercisesByFormat({});
    setWorkoutId(null);
    router.push("/dashboard");
  }

  function goNext() {
    if (step === 2 && totalExercises === 0) {
      setToast({ message: "Selecione ao menos um exercício para continuar.", type: "error" });
      return;
    }
    setStep(s => Math.min(3, s + 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep(s => Math.max(1, s - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-zinc-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-4xl mx-auto px-4 py-5">

        {/* Hero compacto */}
        <div className="mb-5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
            {workoutId ? 'Editando treino' : 'Novo treino'}
          </p>
          <h1 className="font-heading font-black text-3xl uppercase text-white leading-tight">
            Monte seu <span className="text-red-500">treino</span>
          </h1>
        </div>

        <StepIndicator step={step} onGoto={setStep} />

        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-4">
          {step === 1 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
                Escolha o formato do treino
              </p>
              <FormatSelector
                value={format}
                onChange={setFormat}
              />
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
                Selecione os grupos e exercícios
              </p>
              <WorkoutGroupSelector
                format={format}
                selectedMusclesByDay={selectedMusclesByDay}
                selectedExercisesByDay={selectedExercisesByDay}
                onMusclesChange={setMusclesByDay}
                onExercisesChange={setExercisesByDay}
              />
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
                Defina a ordem, séries e cargas
              </p>
              <WorkoutArranger
                format={format}
                selectedMusclesByDay={selectedMusclesByDay}
                selectedExercisesByDay={selectedExercisesByDay}
                onMusclesChange={setMusclesByDay}
                onExercisesChange={setExercisesByDay}
              />
            </>
          )}
        </div>

        {/* Navegação do wizard */}
        <div className="flex flex-col sm:flex-row gap-3 py-6">
          {step > 1 && (
            <button
              onClick={goBack}
              className="py-3.5 px-5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              Voltar
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={goNext}
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Continuar
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving || totalExercises === 0}
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : workoutId ? "Atualizar treino" : "Salvar treino"}
            </button>
          )}

          {workoutId && (
            <button
              onClick={resetForm}
              className="py-3.5 px-5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-sm rounded-xl transition-colors"
            >
              Novo treino
            </button>
          )}
          <Link
            href="/my-workouts"
            className="py-3.5 px-5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold uppercase tracking-wide text-sm rounded-xl transition-colors flex items-center justify-center"
          >
            Ver meus treinos
          </Link>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
}
