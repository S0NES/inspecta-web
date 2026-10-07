export type BadgeTone = 'ink' | 'gray' | 'outline' | 'red';

/**
 * Tom de `Badge` por status, conforme a tabela de FRONTEND.md §2:
 *
 * - `ink` — estado ativo/positivo forte (Em campo, Assinado, Faturada, Aprovada)
 * - `gray` — estado neutro/aguardando (Solicitada, Atribuída, Agendada, A receber)
 * - `outline` — informativo/histórico (Concluída, Corretor, Nova)
 * - `red` — exceção que exige ação (Cancelada, Retida, Ajustes solicitados, Sem assinatura)
 *
 * Chaves normalizadas (minúsculas, sem acento) para tolerar variação de origem entre
 * o read model do inspecta-api e os rótulos das telas.
 */
const TONE_BY_STATUS: Record<string, BadgeTone> = {
  // ink — ativo/positivo forte
  'em campo': 'ink',
  assinado: 'ink',
  faturada: 'ink',
  aprovada: 'ink',
  ativo: 'ink',
  ativa: 'ink',
  pago: 'ink',

  // gray — neutro/aguardando
  solicitada: 'gray',
  atribuida: 'gray',
  agendada: 'gray',
  pendente: 'gray',
  'a receber': 'gray',
  aguardando: 'gray',
  inativo: 'gray',
  inativa: 'gray',

  // outline — informativo/histórico
  concluida: 'outline',
  corretor: 'outline',
  nova: 'outline',

  // red — exceção que exige ação
  cancelada: 'red',
  retida: 'red',
  'ajustes solicitados': 'red',
  'sem assinatura': 'red',
  falhou: 'red',
};

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Tom do badge para um status. Desconhecido cai em `gray` (neutro), nunca em acento. */
export function statusTone(status: string): BadgeTone {
  return TONE_BY_STATUS[normalize(status)] ?? 'gray';
}
