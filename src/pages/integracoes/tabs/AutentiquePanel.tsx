import React, { useEffect, useState } from 'react';
import { useAutentiqueList, type AutentiqueRow } from '../../../api/pleno';
import { useTranslation } from '../../../i18n';
import { IntegracaoTable } from '../IntegracaoTable';
import { signTone, type IntegracaoLinha } from '../shared';
import type { PanelProps } from '../registry';

/**
 * Aba de assinatura — provedor Autentique. Resolvida por `<SignatureTab name="autentique">`.
 * Lê `GET /v1/integracoes/autentique` (signatários reais) e cai no formato genérico de linha.
 */
export const AutentiquePanel: React.FC<PanelProps> = ({ status, q }) => {
  const { t } = useTranslation();
  const tp = t.integracoes;
  const [page, setPage] = useState(0);
  const lista = useAutentiqueList(status, page, q);

  useEffect(() => {
    setPage(0);
  }, [q, status]);

  const linhas: IntegracaoLinha[] = (lista.data?.content ?? []).map((r: AutentiqueRow) => ({
    id: r.id,
    nome: r.nome,
    detalhe: r.email,
    tipo: tp.tipoLabels.assinatura,
    statusLabel: tp.signStatus[r.status] ?? r.status,
    statusTone: signTone(r.status),
    externalId: r.externalDocumentId ?? r.externalSignerId,
    atualizadoEm: r.assinadoEm ?? r.criadoEm,
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
