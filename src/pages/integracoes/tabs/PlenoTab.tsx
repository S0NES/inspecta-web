import React, { useEffect, useState } from 'react';
import {
  usePlenoSyncList,
  usePlenoSyncRetry,
  type PlenoSyncRow,
} from '../../../api/pleno';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../i18n';
import { IntegracaoTable } from '../IntegracaoTable';
import { syncTone, type IntegracaoLinha } from '../shared';
import type { PanelProps } from '../registry';

/**
 * Aba Pleno — dedicada (menos genérica que pagamento/assinatura). Lista o espelho de cada
 * recurso local na Pleno (`GET /v1/pleno/sync`), com re-tentativa de espelhamento por linha.
 */
export const PlenoTab: React.FC<PanelProps> = ({ status, q }) => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tp = t.integracoes;
  const [page, setPage] = useState(0);
  const lista = usePlenoSyncList(status, page, 30, q);
  const retry = usePlenoSyncRetry();

  useEffect(() => {
    setPage(0);
  }, [q, status]);

  const reTentar = async (id: string) => {
    try {
      await retry.mutateAsync(id);
      setToast(tp.requeued);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : tp.retryError);
    }
    setTimeout(() => setToast(null), 3000);
  };

  const tipoDe = (tipo: PlenoSyncRow['recursoTipo']) => tp.tipoLabels[tipo] ?? tipo;

  const linhas: IntegracaoLinha[] = (lista.data?.content ?? []).map((r) => ({
    id: r.id,
    nome: r.recursoNome?.trim() || `${tipoDe(r.recursoTipo)} #${r.recursoId}`,
    detalhe: r.origem === 'manual' ? tp.originManual : tp.originMirror,
    tipo: tipoDe(r.recursoTipo),
    statusLabel: tp.statusLabels[r.status],
    statusTone: syncTone(r.status),
    externalId: r.externalId,
    atualizadoEm: r.ultimoSync,
    erro: r.erro,
    acao: {
      label: tp.retry,
      disabled: retry.isPending,
      onClick: () => {
        void reTentar(r.id);
      },
    },
  }));

  return (
    <IntegracaoTable
      linhas={linhas}
      loading={lista.isLoading}
      error={!!lista.error}
      empty={status || q ? tp.emptyFiltered : tp.emptyNone}
      page={page}
      totalPages={lista.data?.totalPages ?? 1}
      onPage={setPage}
    />
  );
};
