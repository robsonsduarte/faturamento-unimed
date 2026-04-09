/** CID-10 — códigos mais usados em terapias (Fono, Psico, Nutri) + gerais */
export interface Cid10Entry {
  code: string
  description: string
}

export const CID10_DATA: Cid10Entry[] = [
  // === Transtornos mentais e comportamentais (F00-F99) ===
  { code: 'F20', description: 'Esquizofrenia' },
  { code: 'F31', description: 'Transtorno afetivo bipolar' },
  { code: 'F32', description: 'Episodio depressivo' },
  { code: 'F32.0', description: 'Episodio depressivo leve' },
  { code: 'F32.1', description: 'Episodio depressivo moderado' },
  { code: 'F32.2', description: 'Episodio depressivo grave sem sintomas psicoticos' },
  { code: 'F33', description: 'Transtorno depressivo recorrente' },
  { code: 'F40', description: 'Transtornos fobico-ansiosos' },
  { code: 'F40.0', description: 'Agorafobia' },
  { code: 'F40.1', description: 'Fobias sociais' },
  { code: 'F41', description: 'Outros transtornos ansiosos' },
  { code: 'F41.0', description: 'Transtorno de panico' },
  { code: 'F41.1', description: 'Ansiedade generalizada' },
  { code: 'F41.2', description: 'Transtorno misto ansioso e depressivo' },
  { code: 'F42', description: 'Transtorno obsessivo-compulsivo' },
  { code: 'F43', description: 'Reacoes ao stress grave e transtornos de adaptacao' },
  { code: 'F43.0', description: 'Reacao aguda ao stress' },
  { code: 'F43.1', description: 'Estado de stress pos-traumatico' },
  { code: 'F43.2', description: 'Transtornos de adaptacao' },
  { code: 'F50', description: 'Transtornos da alimentacao' },
  { code: 'F50.0', description: 'Anorexia nervosa' },
  { code: 'F50.2', description: 'Bulimia nervosa' },
  { code: 'F60', description: 'Transtornos especificos da personalidade' },
  { code: 'F80', description: 'Transtornos especificos do desenvolvimento da fala e da linguagem' },
  { code: 'F80.0', description: 'Transtorno especifico da articulacao da fala' },
  { code: 'F80.1', description: 'Transtorno expressivo de linguagem' },
  { code: 'F80.2', description: 'Transtorno receptivo de linguagem' },
  { code: 'F80.9', description: 'Transtorno nao especificado do desenvolvimento da fala ou da linguagem' },
  { code: 'F81', description: 'Transtornos especificos do desenvolvimento das habilidades escolares' },
  { code: 'F81.0', description: 'Transtorno especifico de leitura (Dislexia)' },
  { code: 'F81.1', description: 'Transtorno especifico da soletração' },
  { code: 'F81.2', description: 'Transtorno especifico da habilidade em aritmetica (Discalculia)' },
  { code: 'F82', description: 'Transtorno especifico do desenvolvimento motor' },
  { code: 'F83', description: 'Transtornos especificos misto do desenvolvimento' },
  { code: 'F84', description: 'Transtornos globais do desenvolvimento' },
  { code: 'F84.0', description: 'Autismo infantil' },
  { code: 'F84.1', description: 'Autismo atipico' },
  { code: 'F84.5', description: 'Sindrome de Asperger' },
  { code: 'F84.9', description: 'Transtorno global do desenvolvimento nao especificado' },
  { code: 'F88', description: 'Outros transtornos do desenvolvimento psicologico' },
  { code: 'F89', description: 'Transtorno do desenvolvimento psicologico nao especificado' },
  { code: 'F90', description: 'Transtornos hipercineticos' },
  { code: 'F90.0', description: 'Disturbios da atividade e da atencao (TDAH)' },
  { code: 'F91', description: 'Disturbios de conduta' },
  { code: 'F93', description: 'Transtornos emocionais com inicio na infancia' },
  { code: 'F93.0', description: 'Transtorno de ansiedade de separacao na infancia' },
  { code: 'F94', description: 'Transtornos do funcionamento social com inicio na infancia' },
  { code: 'F95', description: 'Tiques' },
  { code: 'F98', description: 'Outros transtornos comportamentais e emocionais inicio na infancia' },
  { code: 'F98.0', description: 'Enurese nao organica' },
  { code: 'F98.5', description: 'Gagueira (tartamudez)' },
  { code: 'F99', description: 'Transtorno mental nao especificado' },

  // === Doenças do ouvido (H60-H95) — Fono/Audiologia ===
  { code: 'H65', description: 'Otite media nao supurativa' },
  { code: 'H66', description: 'Otite media supurativa e as nao especificadas' },
  { code: 'H90', description: 'Perda de audicao por transtorno de conducao e/ou neurossensorial' },
  { code: 'H90.0', description: 'Perda de audicao bilateral por conducao' },
  { code: 'H90.3', description: 'Perda de audicao bilateral neurossensorial' },
  { code: 'H90.5', description: 'Perda de audicao neurossensorial nao especificada' },
  { code: 'H90.6', description: 'Perda de audicao mista bilateral' },
  { code: 'H91', description: 'Outras perdas de audicao' },
  { code: 'H91.9', description: 'Perda nao especificada de audicao' },
  { code: 'H93.1', description: 'Zumbido' },

  // === Doenças do sistema nervoso (G00-G99) ===
  { code: 'G40', description: 'Epilepsia' },
  { code: 'G43', description: 'Enxaqueca' },
  { code: 'G47', description: 'Disturbios do sono' },
  { code: 'G80', description: 'Paralisia cerebral' },
  { code: 'G80.0', description: 'Paralisia cerebral espastica quadriplegia' },
  { code: 'G80.1', description: 'Paralisia cerebral espastica diplegia' },
  { code: 'G80.9', description: 'Paralisia cerebral nao especificada' },

  // === Doenças do aparelho respiratório (J00-J99) ===
  { code: 'J30', description: 'Rinite alergica e vasomotora' },
  { code: 'J31', description: 'Rinite, nasofaringite e faringite cronicas' },
  { code: 'J35', description: 'Doencas cronicas das amigdalas e das adenoides' },
  { code: 'J45', description: 'Asma' },

  // === Doenças endócrinas/nutricionais (E00-E90) ===
  { code: 'E10', description: 'Diabetes mellitus insulino-dependente' },
  { code: 'E11', description: 'Diabetes mellitus nao insulino-dependente' },
  { code: 'E44', description: 'Desnutricao proteico-calorica de grau moderado e leve' },
  { code: 'E46', description: 'Desnutricao proteico-calorica nao especificada' },
  { code: 'E63', description: 'Outras deficiencias nutricionais' },
  { code: 'E66', description: 'Obesidade' },
  { code: 'E66.0', description: 'Obesidade devida a excesso de calorias' },
  { code: 'E66.9', description: 'Obesidade nao especificada' },
  { code: 'E78', description: 'Disturbios do metabolismo de lipoproteinas e outras lipidemias' },

  // === Malformações congênitas (Q00-Q99) ===
  { code: 'Q35', description: 'Fenda palatina' },
  { code: 'Q36', description: 'Labio leporino' },
  { code: 'Q37', description: 'Fenda labial com fenda palatina' },
  { code: 'Q90', description: 'Sindrome de Down' },

  // === Doenças cerebrovasculares (I60-I69) ===
  { code: 'I63', description: 'Infarto cerebral' },
  { code: 'I64', description: 'Acidente vascular cerebral nao especificado' },
  { code: 'I69', description: 'Sequelas de doencas cerebrovasculares' },

  // === Sintomas e sinais (R00-R99) ===
  { code: 'R13', description: 'Disfagia' },
  { code: 'R47', description: 'Disturbios da fala nao classificados em outra parte' },
  { code: 'R47.0', description: 'Disfasia e afasia' },
  { code: 'R47.1', description: 'Disartria e anartria' },
  { code: 'R48', description: 'Dislexia e outras disfuncoes simbolicas nao classificadas' },
  { code: 'R49', description: 'Disturbios da voz' },
  { code: 'R49.0', description: 'Disfonia' },
  { code: 'R62', description: 'Retardo do desenvolvimento fisiologico normal' },
  { code: 'R62.0', description: 'Etapas de desenvolvimento retardadas' },
  { code: 'R63', description: 'Sintomas e sinais relativos a ingestao de alimentos e liquidos' },

  // === Lesões/causas externas ===
  { code: 'S06', description: 'Traumatismo intracraniano' },
  { code: 'T90', description: 'Sequelas de traumatismos da cabeca' },

  // === Fatores de saúde (Z00-Z99) ===
  { code: 'Z03', description: 'Observacao e avaliacao medica por suspeita de doencas' },
  { code: 'Z13', description: 'Exame especial de rastreamento de outras doencas' },
  { code: 'Z50', description: 'Cuidados envolvendo o uso de procedimentos de reabilitacao' },
  { code: 'Z50.5', description: 'Fonoterapia' },
  { code: 'Z71', description: 'Pessoas em contato com servicos de saude para outros aconselhamentos' },
  { code: 'Z73', description: 'Problemas relacionados com a organizacao do modo de vida' },
  { code: 'Z73.0', description: 'Esgotamento (Burnout)' },
]

/** Search CID-10 by code or description (case-insensitive, accent-insensitive) */
export function searchCid10(query: string, limit = 10): Cid10Entry[] {
  if (!query.trim()) return []
  const normalised = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return CID10_DATA.filter((entry) => {
    const code = entry.code.toLowerCase()
    const desc = entry.description
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    return code.includes(normalised) || desc.includes(normalised)
  }).slice(0, limit)
}
