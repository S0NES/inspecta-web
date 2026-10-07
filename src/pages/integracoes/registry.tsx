import type React from 'react';
import { getTranslations } from '../../i18n';
import { AbacatePayPanel } from './tabs/AbacatePayPanel';
import { AutentiquePanel } from './tabs/AutentiquePanel';

/** Props que todo painel de integração recebe do shell (`Integracoes.tsx`). */
export interface PanelProps {
  /** Filtro de status ativo (`''` = todos). Vocabulário próprio de cada integração. */
  status: string;
  /** Busca livre (debounced) do header. */
  q: string;
}

export interface IntegracaoProvider {
  /** Rótulo da aba no `<Tabs>`. */
  label: string;
  /** Componente renderizado quando a aba está ativa. */
  Panel: React.FC<PanelProps>;
  /** Chips do modal de filtro do header (o primeiro é sempre "Todos", `value: ''`). */
  statusOptions: { value: string; label: string }[];
}

const t = getTranslations().integracoes;
const todos = { value: '', label: t.filters.all };

/** Opções do filtro de status da aba Pleno — consumidas pelo header do shell (`Integracoes.tsx`). */
export const PLENO_STATUS_OPTIONS: { value: string; label: string }[] = [
  todos,
  { value: 'pendente', label: t.filters.pending },
  { value: 'erro', label: t.filters.error },
  { value: 'sincronizado', label: t.filters.synced },
];

/**
 * Mapa `nome do provedor → componente`. `<PaymentTab name>` / `<SignatureTab name>` fazem o
 * inspecta-messenger por aqui (equivalente idiomático do switch-case). Nome que não está no mapa cai no
 * `<UnsupportedPanel>`. Só o Pleno fica de fora — tem aba dedicada (`PlenoTab`).
 */
export const PAYMENT_PROVIDERS: Record<string, IntegracaoProvider> = {
  abacatepay: {
    label: t.providers.abacatepay,
    Panel: AbacatePayPanel,
    statusOptions: [todos, ...Object.entries(t.payStatus).map(([value, label]) => ({ value, label }))],
  },
};

export const SIGNATURE_PROVIDERS: Record<string, IntegracaoProvider> = {
  autentique: {
    label: t.providers.autentique,
    Panel: AutentiquePanel,
    statusOptions: [todos, ...Object.entries(t.signStatus).map(([value, label]) => ({ value, label }))],
  },
};
