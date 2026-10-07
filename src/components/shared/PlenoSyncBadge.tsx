import React from 'react';
import { Badge } from './DataDisplay';
import { usePlenoSync, type PlenoRecurso } from '../../api/pleno';
import { useTranslation, fmt } from '../../i18n';

interface Props {
  tipo: PlenoRecurso;
  id: string | null | undefined;
  /** Em listagens, passar `enabled={linhaExpandida}` para não disparar N requests. */
  enabled?: boolean;
  /** Em listagens, `poll={false}` desliga o re-fetch de 15s dos itens `pendente`. */
  poll?: boolean;
}

/**
 * Estado do espelho Pleno de um recurso, como badge:
 * - pendente  → cinza "Espelho Pleno pendente"
 * - erro      → vermelho "Espelho Pleno falhou"
 * - sincronizado → outline "Pleno · {externalId}"
 * Nada quando ainda não há vínculo.
 */
export const PlenoSyncBadge: React.FC<Props> = ({ tipo, id, enabled, poll }) => {
  const { data } = usePlenoSync(tipo, id, { enabled, poll });
  const { t } = useTranslation();
  const tb = t.components.plenoSyncBadge;
  if (!data) return null;

  if (data.status === 'pendente') return <Badge tone="gray">{tb.pending}</Badge>;
  if (data.status === 'erro') return <Badge tone="red">{tb.failed}</Badge>;
  return <Badge tone="outline">{fmt(tb.synced, { id: data.externalId ?? tb.syncedOk })}</Badge>;
};
