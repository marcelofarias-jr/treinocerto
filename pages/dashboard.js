import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import FormatSelector from "../components/FormatSelector";
import DayMuscleGroupSelector from "../components/DayMuscleGroupSelector";
import DayExerciseSelector from "../components/DayExerciseSelector";
import Toast from "../components/Toast";
import { formatConfigs } from "../lib/workoutConfig";

function normalizeExercise(item) {
  return typeof item === "string"
    ? { name: item, carga: "", repeticoes: "", observacoes: "" }
    : item;
}

function StepLabel({ number, label }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">
        {number}
      </span>
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { edit } = router.query;
  const [format, setFormat] = useState("fullbody");
  const [selectedMusclesByDay, setSelectedMusclesByDay] = useState({});
  const [selectedExercisesByDay, setSelectedExercisesByDay] = useState({});
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
              setSelectedMusclesByDay(musclesByDay);
              setSelectedExercisesByDay(exercisesByDay);
            } else {
              setSelectedExercisesByDay({ "1": (workout.exercises || []).map(normalizeExercise) });
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

  async function save() {
    setSaving(true);
    const config = formatConfigs[format];
    const days = config.days.map(day => {
      const muscleGroups = selectedMusclesByDay[day.id] || [];
      const exercises = muscleGroups.map(mg => ({
        muscleGroup: mg,
        exercises: selectedExercisesByDay[`${day.id}_${mg}`] || []
      }));
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
    setFormat("fullbody");
    setSelectedMusclesByDay({});
    setSelectedExercisesByDay({});
    setWorkoutId(null);
    router.push("/dashboard");
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
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Hero */}
        <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-8 mb-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-900/20 rounded-full blur-3xl pointer-events-none" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
            {workoutId ? '· Editando treino ·' : '· Novo treino ·'}
          </p>
          <h1 className="font-heading font-black text-5xl uppercase text-white leading-tight">
            MONTE O TREINO.
          </h1>
          <h1 className="font-heading font-black text-5xl uppercase text-red-500 leading-tight">
            LEVANTE PESADO.
          </h1>
          <p className="text-zinc-500 text-sm mt-3 max-w-lg">
            Selecione o tipo de divisão semanal. Em seguida escolha os músculos de cada dia e os exercícios.
          </p>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6">
            <StepLabel number="1" label="Escolha o formato" />
            <FormatSelector value={format} onChange={f => { setFormat(f); setSelectedMusclesByDay({}); setSelectedExercisesByDay({}); }} />
          </div>

          {/* Step 2 */}
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6">
            <StepLabel number="2" label="Selecione os grupos musculares" />
            <DayMuscleGroupSelector
              format={format}
              selectedByDay={selectedMusclesByDay}
              onChange={setSelectedMusclesByDay}
            />
          </div>

          {/* Step 3 */}
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6">
            <StepLabel number="3" label="Escolha os exercícios" />
            <DayExerciseSelector
              format={format}
              selectedMusclesByDay={selectedMusclesByDay}
              selectedExercisesByDay={selectedExercisesByDay}
              onChange={setSelectedExercisesByDay}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-8">
            <button
              onClick={save}
              disabled={saving}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : workoutId ? "Atualizar treino" : "Salvar treino"}
            </button>
            {workoutId && (
              <button
                onClick={resetForm}
                className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 font-semibold uppercase tracking-wide text-sm rounded-xl transition-colors"
              >
                Novo treino
              </button>
            )}
            <Link
              href="/my-workouts"
              className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 font-semibold uppercase tracking-wide text-sm rounded-xl transition-colors flex items-center"
            >
              Ver meus treinos
            </Link>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
}
