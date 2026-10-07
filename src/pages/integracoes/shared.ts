/** Tipos e helpers puros do painel de integrações — sem componentes, para o fast-refresh. */

export type BadgeTone = 'gray' | 'red' | 'outline' | 'ink';

export const fmtDateTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

export const brl = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Tom do badge do espelho Pleno. */
export const syncTone = (s: string): BadgeTone =>
  s === 'erro' ? 'red' : s === 'sincronizado' ? 'outline' : 'gray';

/** Tom do badge de pagamento (AbacatePay e afins). */
export const payTone = (s: string): BadgeTone => {
  if (s === 'pago') return 'ink';
  if (s === 'falhou' || s === 'estornado') return 'red';
  return 'outline';
};

/** Tom do badge de assinatura (Autentique e afins). */
export const signTone = (s: string): BadgeTone => {
  if (s === 'assinado') return 'ink';
  if (s === 'recusado') return 'red';
  return 'gray';
};

/** Linha única do painel — qualquer provedor cai neste formato. */
export interface IntegracaoLinha {
  id: string;
  nome: string;
  detalhe?: string | null;
  detalheHref?: string | null;
  tipo: string;
  statusLabel: string;
  statusTone: BadgeTone;
  externalId: string | null;
  atualizadoEm: string | null;
  erro?: string | null;
  acao?: { label: string; onClick: () => void; disabled?: boolean };
}
