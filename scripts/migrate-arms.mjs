// Migração pontual: o grupo guarda-chuva 'braços' deixou de existir — cada
// exercício passa a ser 'bíceps' ou 'tríceps'.
//
// Reclassifica os dados já salvos em workouts.days, sessions.exercises_data e
// custom_exercises.muscle_group. A ordem dos exercícios dentro do dia é
// preservada: o dia é achatado, remapeado e reagrupado em blocos consecutivos.
//
//   node scripts/migrate-arms.mjs            → dry run, não escreve nada
//   node scripts/migrate-arms.mjs --apply    → grava (backup JSON antes)
//
// Idempotente: rodar de novo depois de aplicado não encontra nada para mudar.

import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
const LEGACY = 'braços'

// workoutConfig.js é ESM num pacote CommonJS: importa via cópia .mjs.
const tmp = path.join(os.tmpdir(), `workoutConfig.${process.pid}.mjs`)
fs.copyFileSync(path.join(ROOT, 'lib/workoutConfig.js'), tmp)
const { exercisesByMuscleGroup, blocksToFlat, flatToBlocks } = await import(`file://${tmp}`)
fs.unlinkSync(tmp)

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const unresolved = []

// Catálogo primeiro (resolve tudo que é exercício padrão); heurística de nome
// só para exercícios customizados. Padrões de tríceps antes dos de bíceps
// porque "Rosca Francesa" e "Rosca Testa" são exercícios de tríceps.
function classify(name) {
  const n = String(name).trim().toLowerCase()
  const inList = mg => (exercisesByMuscleGroup[mg] || []).some(x => x.toLowerCase() === n)
  if (inList('tríceps')) return 'tríceps'
  if (inList('bíceps')) return 'bíceps'
  if (/tríceps|triceps|testa|francesa|mergulho|paralela|extens|coice|diamante/.test(n)) return 'tríceps'
  if (/rosca|bíceps|biceps|curl|chin/.test(n)) return 'bíceps'
  unresolved.push(name)
  return null
}

const workoutChanges = []
const sessionChanges = []
const customChanges = []

const { data: workouts, error: wErr } = await sb.from('workouts').select('id,format,days')
if (wErr) throw new Error(`workouts: ${wErr.message}`)

for (const w of workouts) {
  if (!Array.isArray(w.days)) continue
  let touched = false
  const days = w.days.map(day => {
    if (!(day.exercises || []).some(b => b.muscleGroup === LEGACY)) return day
    // Achata → remapeia → reagrupa: a sequência do dia fica intacta.
    const flat = blocksToFlat(day.exercises).map(item => {
      if (item.muscleGroup !== LEGACY) return item
      const mg = classify(item.name)
      if (!mg) return item
      touched = true
      return { ...item, muscleGroup: mg }
    })
    return { ...day, exercises: flatToBlocks(flat) }
  })
  if (touched) workoutChanges.push({ id: w.id, format: w.format, before: w.days, days })
}

const { data: sessions, error: sErr } = await sb.from('sessions').select('id,date,day_label,exercises_data')
if (sErr) throw new Error(`sessions: ${sErr.message}`)

for (const s of sessions) {
  if (!(s.exercises_data || []).some(e => e.muscleGroup === LEGACY)) continue
  let touched = false
  const exercises_data = s.exercises_data.map(e => {
    if (e.muscleGroup !== LEGACY) return e
    const mg = classify(e.name)
    if (!mg) return e
    touched = true
    return { ...e, muscleGroup: mg }
  })
  if (touched) sessionChanges.push({ id: s.id, date: s.date, label: s.day_label, before: s.exercises_data, exercises_data })
}

const { data: customs, error: cErr } = await sb.from('custom_exercises').select('id,name,muscle_group')
if (cErr) throw new Error(`custom_exercises: ${cErr.message}`)

for (const c of customs) {
  if (c.muscle_group !== LEGACY) continue
  const mg = classify(c.name)
  if (mg) customChanges.push({ id: c.id, name: c.name, muscle_group: mg })
}

console.log(APPLY ? '── APLICANDO ──' : '── DRY RUN (nada será gravado) ──')

for (const w of workoutChanges) {
  console.log(`\nworkout #${w.id} (${w.format})`)
  w.days.forEach((day, i) => {
    const antes = blocksToFlat(w.before[i].exercises)
    const depois = blocksToFlat(day.exercises)
    depois.forEach((ex, j) => {
      if (antes[j].muscleGroup !== ex.muscleGroup) {
        console.log(`  ${day.label}: ${ex.name.padEnd(24)} ${antes[j].muscleGroup} → ${ex.muscleGroup}`)
      }
    })
  })
}
console.log(`\nsessions: ${sessionChanges.length} a atualizar`)
sessionChanges.forEach(s => {
  const alvos = s.exercises_data.filter((e, i) => e.muscleGroup !== s.before[i].muscleGroup)
  console.log(`  ${s.date} ${s.label || ''} — ${alvos.map(e => `${e.name} → ${e.muscleGroup}`).join(', ')}`)
})
console.log(`\ncustom_exercises: ${customChanges.length} a atualizar`)
customChanges.forEach(c => console.log(`  ${c.name} → ${c.muscle_group}`))

if (unresolved.length) {
  console.log(`\n⚠ NÃO CLASSIFICADOS (mantidos como '${LEGACY}'): ${[...new Set(unresolved)].join(', ')}`)
}

const total = workoutChanges.length + sessionChanges.length + customChanges.length
if (total === 0) { console.log('\nNada a fazer.'); process.exit(0) }

if (!APPLY) {
  console.log(`\n${total} registros seriam alterados. Rode com --apply para gravar.`)
  process.exit(0)
}

const backup = path.join(ROOT, `backup-arms-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
fs.writeFileSync(backup, JSON.stringify({ workoutChanges, sessionChanges, customs: customs.filter(c => c.muscle_group === LEGACY) }, null, 2))
console.log(`\nBackup: ${backup}`)

for (const w of workoutChanges) {
  const { error } = await sb.from('workouts').update({ days: w.days }).eq('id', w.id)
  if (error) throw new Error(`workout ${w.id}: ${error.message}`)
}
for (const s of sessionChanges) {
  const { error } = await sb.from('sessions').update({ exercises_data: s.exercises_data }).eq('id', s.id)
  if (error) throw new Error(`session ${s.id}: ${error.message}`)
}
for (const c of customChanges) {
  const { error } = await sb.from('custom_exercises').update({ muscle_group: c.muscle_group }).eq('id', c.id)
  if (error) throw new Error(`custom ${c.id}: ${error.message}`)
}
console.log(`\n✓ ${total} registros atualizados.`)
