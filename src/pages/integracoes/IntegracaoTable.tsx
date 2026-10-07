import React from 'react';
import { Card, Badge, Pagination } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { useTranslation } from '../../i18n';
import { fmtDateTime, type IntegracaoLinha } from './shared';

interface IntegracaoTableProps {
  linhas: IntegracaoLinha[];
  loading: boolean;
  error: boolean;
  empty: string;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

/**
 * Tabela genérica de uma integração: mesmas colunas (nome, tipo, status, id externo, atualizado,
 * ação) para Pleno, pagamento e assinatura. Sem filtro embutido — quem filtra é o header da tela
 * (`Integracoes.tsx`).
 */
export const IntegracaoTable: React.FC<IntegracaoTableProps> = ({
  linhas,
  loading,
  error,
  empty,
  page,
  totalPages,
  onPage,
}) => {
  const { t } = useTranslation();
  const tp = t.integracoes;

  return (
    <section>
      <Card>
        {loading && <p className="intg-empty">{tp.loading}</p>}
        {error && <p className="intg-empty">{tp.loadError}</p>}
        {!loading && !error && linhas.length === 0 && <p className="intg-empty">{empty}</p>}

        {linhas.length > 0 && (
          <div className="intg-table">
            <div className="intg-row intg-row--head">
              <span>{tp.colName}</span>
              <span>{tp.colType}</span>
              <span>{tp.colStatus}</span>
              <span>{tp.colExternalId}</span>
              <span>{tp.colUpdated}</span>
              <span className="intg-acao" />
            </div>
            {linhas.map((r) => (
              <div key={r.id} className="intg-row">
                <span className="intg-recurso">
                  {r.nome}
                  {r.detalhe && r.detalheHref && (
                    <a
                      className="intg-recurso-nome"
                      href={r.detalheHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {' '}
                      — {r.detalhe}
                    </a>
                  )}
                  {r.detalhe && !r.detalheHref && (
                    <span className="intg-recurso-nome"> — {r.detalhe}</span>
                  )}
                </span>
                <span className="intg-mono">{r.tipo}</span>
                <span>
                  <Badge tone={r.statusTone}>{r.statusLabel}</Badge>
                  {r.erro && (
                    <span className="intg-erro" title={r.erro}>
                      · {r.erro}
                    </span>
                  )}
                </span>
                <span className="intg-mono">{r.externalId ?? '—'}</span>
                <span className="intg-mono">{fmtDateTime(r.atualizadoEm)}</span>
                <span className="intg-acao">
                  {r.acao && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={r.acao.disabled}
                      onClick={r.acao.onClick}
                    >
                      {r.acao.label}
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Pagination page={page} totalPages={totalPages} onPage={onPage} className="intg-paginacao" />
    </section>
  );
};
