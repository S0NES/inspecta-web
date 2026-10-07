import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useSolicitacoes, type StatusKey } from '../../api/solicitacoes';
import { statusTone } from '../../utils/statusTone';
import { PagarCta } from '../../components/shared/PagarCta';
import { useTranslation, fmt } from '../../i18n';
import './RequestsBoard.css';

const COLUNA_KEYS: StatusKey[] = [
  'solicitada',
  'atribuida',
  'agendada',
  'em_campo',
  'concluida',
  'cancelada',
];

const COL_SIZE = 50;

interface RequestsBoardProps {
  /** Filtro de imobiliária compartilhado com a visão de lista. */
  imobiliariaId?: string;
  /** Busca (SOL- ou endereço) compartilhada com a visão de lista. */
  search?: string;
  /** Chip de status ativo: se setado, o quadro mostra só essa coluna. */
  statusFilter?: StatusKey | '';
}

/**
 * Quadro kanban de solicitações (6 colunas por status). Usado dentro de
 * `Requests.tsx` quando a visualização está em "Board". Não tem cabeçalho de
 * página nem filtros próprios — recebe imobiliária/busca/status por prop.
 */
export const RequestsBoard: React.FC<RequestsBoardProps> = ({ imobiliariaId, search, statusFilter }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tb = t.requests.board;
  // O CTA "Pagar" não faz sentido para o vistoriador (perfil de fila, só leitura).
  const isVistoriador = useAppStore((s) => s.role) === 'vistoriador';
  const statusLabel = (k: StatusKey) => t.requests.statusLabels[k];

  const base = { imobiliariaId, q: search || undefined, size: COL_SIZE } as const;
  // Chip de status ativo → só a coluna correspondente é consultada; as outras 5 ficam desligadas.
  const on = (key: StatusKey) => !statusFilter || statusFilter === key;

  // Uma query por coluna — contagem fixa de hooks, ok para as regras do React.
  const q0 = useSolicitacoes({ ...base, status: 'solicitada', enabled: on('solicitada') });
  const q1 = useSolicitacoes({ ...base, status: 'atribuida', enabled: on('atribuida') });
  const q2 = useSolicitacoes({ ...base, status: 'agendada', enabled: on('agendada') });
  const q3 = useSolicitacoes({ ...base, status: 'em_campo', enabled: on('em_campo') });
  const q4 = useSolicitacoes({ ...base, status: 'concluida', enabled: on('concluida') });
  const q5 = useSolicitacoes({ ...base, status: 'cancelada', enabled: on('cancelada') });
  // Ordem = COLUNAS; o índice de cada coluna indexa este array.
  const queries = [q0, q1, q2, q3, q4, q5];

  const colunas = statusFilter ? COLUNA_KEYS.filter((k) => k === statusFilter) : COLUNA_KEYS;

  const abrir = (solicitacaoId: string) => {
    navigate(`/inspections/${solicitacaoId}`);
  };

  return (
    <div className="kanban-board">
      {colunas.map((col) => {
        const query = queries[COLUNA_KEYS.indexOf(col)];
        const itens = query.data?.content ?? [];
        const total = query.data?.totalElements ?? itens.length;
        return (
          <div key={col} className="kanban-col">
            <div className="kanban-col-head">
              <span className={`badge badge--${statusTone(col)}`}>{statusLabel(col)}</span>
              <span className="kanban-col-count">{total}</span>
            </div>
            <div className="kanban-col-body">
              {query.isLoading && <p className="kanban-empty">{tb.loading}</p>}
              {query.error && <p className="kanban-empty">{tb.loadError}</p>}
              {!query.isLoading && !query.error && itens.length === 0 && (
                <p className="kanban-empty">{tb.empty}</p>
              )}
              {itens.map((s) => (
                <div
                  key={s.id}
                  className="kanban-card"
                  role="button"
                  tabIndex={0}
                  aria-label={fmt(tb.cardAria, { id: s.solicitacaoId, endereco: s.endereco, status: statusLabel(col) })}
                  onClick={() => abrir(s.solicitacaoId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      abrir(s.solicitacaoId);
                    }
                  }}
                >
                  <div className="kanban-card-top">
                    <span className="kanban-card-id">{fmt(tb.solLabel, { id: s.solicitacaoId })}</span>
                    {s.urgente && (
                      <span className="kanban-card-urgent" role="img" aria-label={tb.urgent}>●</span>
                    )}
                  </div>
                  <div className="kanban-card-addr">{s.endereco}</div>
                  <div className="kanban-card-meta">
                    <span>{s.tipo}</span>
                    {s.vistoriador && <><span aria-hidden="true">·</span><span>{s.vistoriador}</span></>}
                  </div>
                  <div className="kanban-card-meta">
                    <span>{s.data}</span>
                    {s.hora && <><span aria-hidden="true">·</span><span>{s.hora}</span></>}
                  </div>
                  {!isVistoriador && s.checkoutUrl && s.paymentStatus !== 'pago' && (
                    <div className="kanban-card-meta" style={{ marginTop: 6 }}>
                      <PagarCta
                        solicitacaoId={s.solicitacaoId}
                        checkoutUrl={s.checkoutUrl}
                        paymentStatus={s.paymentStatus}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
