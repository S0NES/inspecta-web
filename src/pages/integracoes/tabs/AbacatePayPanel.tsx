import React, { useEffect, useState } from 'react';
import { useAbacatePayList, type AbacatePayRow } from '../../../api/pleno';
import { useTranslation, fmt } from '../../../i18n';
import { IntegracaoTable } from '../IntegracaoTable';
import { brl, payTone, type IntegracaoLinha } from '../shared';
import type { PanelProps } from '../registry';

/**
 * Aba de pagamento — provedor AbacatePay. Resolvida por `<PaymentTab name="abacatepay">`.
 * Lê `GET /v1/integracoes/abacatepay` (cobranças reais) e cai no formato genérico de linha.
 */
export const AbacatePayPanel: React.FC<PanelProps> = ({ status, q }) => {
  const { t } = useTranslation();
  const tp = t.integracoes;
  const [page, setPage] = useState(0);
  const lista = useAbacatePayList(status, page, q);

  useEffect(() => {
    setPage(0);
  }, [q, status]);

  const linhas: IntegracaoLinha[] = (lista.data?.content ?? []).map((r: AbacatePayRow) => ({
    id: r.id,
    nome: fmt(tp.solicitacaoNome, { id: r.solicitacaoId }),
    detalhe: brl(r.valor ?? 0),
    tipo: tp.tipoLabels.pagamento,
    statusLabel: tp.payStatus[r.status] ?? r.status,
    statusTone: payTone(r.status),
    externalId: r.externalId,
    atualizadoEm: r.criadoEm,
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
