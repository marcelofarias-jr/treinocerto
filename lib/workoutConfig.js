// Definição de formatos com dias e grupos de músculos
export const formatConfigs = {
  fullbody: {
    name: 'Full Body',
    days: [
      { id: 1, name: 'Dia 1', label: 'Corpo Todo', muscleGroups: ['peito', 'costa', 'ombro', 'braços', 'pernas', 'glúteos', 'panturrilha', 'abdômen'] }
    ]
  },
  upper_lower: {
    name: 'Upper/Lower',
    days: [
      { id: 'A', name: 'Dia A', label: 'Upper (Superior)', muscleGroups: ['peito', 'costa', 'ombro', 'trapézio', 'braços'] },
      { id: 'B', name: 'Dia B', label: 'Lower (Inferior)', muscleGroups: ['pernas', 'glúteos', 'panturrilha', 'abdômen'] }
    ]
  },
  ppl: {
    name: 'Push/Pull/Legs',
    days: [
      { id: 'A', name: 'Dia A', label: 'Push (Empurrar)', muscleGroups: ['peito', 'ombro', 'tríceps'] },
      { id: 'B', name: 'Dia B', label: 'Pull (Puxar)', muscleGroups: ['costa', 'trapézio', 'bíceps', 'antebraço'] },
      { id: 'C', name: 'Dia C', label: 'Legs (Pernas)', muscleGroups: ['pernas', 'glúteos', 'panturrilha', 'abdômen'] }
    ]
  }
}

// Exercícios por grupo muscular
// Nota: 'braços' é o dia combinado (fullbody/upper_lower) — compartilha exercícios com 'bíceps' e 'tríceps'
// intencionalmente, pois nunca aparecem juntos no mesmo treino.
export const exercisesByMuscleGroup = {
  peito: [
    'Supino Reto',
    'Supino Inclinado',
    'Supino Declinado',
    'Supino Máquina',
    'Peck Deck (Voador)',
    'Crucifixo',
    'Crossover no Cabo',
    'Flexão de Braço',
    'Paralelas para Peito',
    'Pullover',
  ],
  costa: [
    'Barra Fixa (Pull-up)',
    'Pulley Costas',
    'Puxada Atrás da Cabeça',
    'Remada Curvada',
    'Remada Unilateral (Serrote)',
    'Remada Baixa',
    'Remada na Máquina',
    'Remada com Barra T',
    'Remada Cavalinho',
  ],
  ombro: [
    'Desenvolvimento',
    'Desenvolvimento Arnold',
    'Desenvolvimento na Máquina',
    'Elevação Lateral',
    'Elevação Lateral na Polia',
    'Elevação Lateral Inclinada',
    'Elevação Frontal',
    'Face Pull',
    'Voador Invertido',
    'Crucifixo Invertido',
  ],
  braços: [
    'Rosca Direta',
    'Rosca Alternada',
    'Rosca Martelo',
    'Rosca Scott',
    'Rosca Concentrada',
    'Tríceps Pulley Corda',
    'Tríceps Pulley V-Bar',
    'Tríceps Banco',
    'Rosca Francesa',
    'Mergulho em Paralelas',
  ],
  bíceps: [
    'Rosca Direta',
    'Rosca Alternada',
    'Rosca Simultânea',
    'Rosca Scott',
    'Rosca Concentrada',
    'Rosca Martelo',
    'Rosca Inclinada',
    'Rosca Spider',
    'Rosca Inversa',
    'Drag Curl',
    'Rosca Zottman',
    'Rosca no Cabo',
    'Rosca Unilateral no Cabo',
    'Chin-up',
  ],
  tríceps: [
    'Tríceps Pulley Corda',
    'Tríceps Pulley V-Bar',
    'Tríceps Pulley Invertido',
    'Rosca Francesa',
    'Tríceps Testa',
    'Supino Fechado',
    'Tríceps Banco',
    'Tríceps Coice',
    'Flexão Diamante',
    'Mergulho em Paralelas',
    'Extensão Acima da Cabeça',
    'Tríceps na Máquina',
  ],
  trapézio: [
    'Encolhimento',
    'Encolhimento no Smith',
    'Encolhimento na Máquina',
    'Remada Alta',
    'Elevação em Y',
    'Depressão Escapular na Polia',
    'Levantamento Terra',
  ],
  pernas: [
    'Agachamento Livre',
    'Agachamento Frontal',
    'Agachamento Goblet',
    'Agachamento Sumô',
    'Agachamento Búlgaro',
    'Agachamento Sissy',
    'Leg Press 45°',
    'Hack Machine',
    'Afundo',
    'Cadeira Extensora',
    'Mesa Flexora',
    'Levantamento Terra Romeno',
    'Levantamento Terra Sumô',
    'Levantamento Terra Convencional',
    'Stiff',
    'Flexão Nórdica',
    'Good Morning',
    'Cadeira Adutora',
  ],
  glúteos: [
    'Hip Thrust',
    'Hip Thrust na Máquina',
    'Elevação Pélvica (Glute Bridge)',
    'Extensão do Quadril na Polia',
    'Kickback de Glúteo',
    'Cadeira Abdutora',
  ],
  panturrilha: [
    'Elevação de Panturrilhas em Pé',
    'Elevação de Panturrilhas Sentado',
    'Elevação de Panturrilhas no Leg Press',
  ],
  antebraço: [
    'Rosca de Punho',
    'Rosca de Punho Invertida',
    'Rosca Reversa',
    'Dead Hang',
    'Rolo de Punho',
    'Flexão de Punho',
    'Extensão de Punho',
  ],
  abdômen: [
    'Abdominal Solo (Crunch)',
    'Abdominal na Máquina',
    'Abdominal na Polia',
    'Abdominal Declinado',
    'Abdominal Cruzado',
    'Abdominal Lateral',
    'Abdominal Tesoura',
    'Abdominal Remador',
    'Abdominal Invertido',
    'Abdominal Infra Paralelas',
    'Prancha',
    'Roda Abdominal',
    'Levantamento de Pernas Suspenso',
    'Levantamento de Pernas no Banco',
  ],
}

export const muscleGroupLabels = {
  peito: 'Peito',
  costa: 'Costas',
  ombro: 'Ombros',
  braços: 'Braços',
  bíceps: 'Bíceps',
  tríceps: 'Tríceps',
  trapézio: 'Trapézio',
  pernas: 'Pernas',
  glúteos: 'Glúteos',
  panturrilha: 'Panturrilha',
  antebraço: 'Antebraço',
  abdômen: 'Abdômen/Core',
}
