import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Card, Badge } from '../../components/shared/DataDisplay';
import { InfoHint } from '../../components/shared/InfoHint';
import { Icon } from '../../components/shared/Icon';
import { useEarnings } from '../../hooks/useEarnings';
import { useTranslation, fmt } from '../../i18n';
import './Earnings.css';

export const Earnings: React.FC = () => {
  const { auth } = useAppStore();
  const { t } = useTranslation();
  const tg = t.extrato.earnings;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sem vistoriadorId a query fica desabilitada (ver useEarnings) e a tela mostra o
  // estado vazio real em vez de dado fabricado.
  // O backend (Periodo.range) exige `YYYY-MM` — mandar a data completa lançava 400
  // (RELATORIO.md, adjacente ao achado #6).
  const periodo = new Date().toISOString().slice(0, 7);
  const vistoriadorId = auth?.userId ?? undefined;

  const { data: earningsData, isLoading, error } = useEarnings(vistoriadorId, periodo);

  // Map backend data to UI structure
  const earnings = useMemo(() => {
    if (!earningsData) return [];

    return (earningsData.pagamentos || []).map((pag: any, idx: number) => ({
      id: `EARN-${String(idx + 1).padStart(3, '0')}`,
      data: new Date(pag.dataRecebimento || pag.periodo).toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'short',
      }).replace('.', ''),
      descricao: fmt(tg.inspectionPeriod, { periodo: pag.periodo }),
      valor: `R$ ${pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      status: mapPagamentoStatus(pag.status),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earningsData, tg]);

  const totals = useMemo(() => {
    if (!earningsData) return null;

    return {
      recebido: `R$ ${earningsData.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      aReceber: `R$ ${earningsData.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      retido: 'R$ 0,00', // Não fornecido pela API ainda — backend só distingue pago/pendente.
    };
  }, [earningsData]);

  function mapPagamentoStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'RECEBIDO': tg.statusReceived,
      'PENDENTE': tg.statusToReceive,
      'RETIDO': tg.statusHeld,
      'AGUARDANDO': tg.statusToReceive,
    };
    return statusMap[status?.toUpperCase()] || tg.statusToReceive;
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusBadgeTone = (status: string): 'ink' | 'gray' | 'outline' | 'red' => {
    if (status === tg.statusReceived) return 'ink';
    if (status === tg.statusToReceive) return 'gray';
    if (status === tg.statusHeld) return 'red';
    return 'gray';
  };

  return (
    <div className="earnings-container">
      {/* Header */}
      <div className="earnings-header">
        <div>
          <InfoHint title={tg.hintTitle}>
            <p>{tg.hintBody}</p>
          </InfoHint>
        </div>
      </div>

      {/* Totals Section */}
      {totals && (
        <div className="earnings-totals">
          <Card>
            <div className="totals-grid">
              <div className="total-item">
                <p className="total-label">{tg.totalReceived}</p>
                <p className="total-value">{totals.recebido}</p>
              </div>
              <div className="total-item">
                <p className="total-label">{tg.totalToReceive}</p>
                <p className="total-value">{totals.aReceber}</p>
              </div>
              <div className="total-item">
                <p className="total-label">{tg.totalHeld}</p>
                <p className="total-value">{totals.retido}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Loading/Error states */}
      {isLoading && (
        <div className="earnings-loading">
          <p>{tg.loading}</p>
        </div>
      )}
      {error && (
        <div className="earnings-error">
          <p>{tg.loadError}</p>
        </div>
      )}
      {!isLoading && !error && earnings.length === 0 && (
        <div className="earnings-error">
          <p>{tg.empty}</p>
        </div>
      )}

      {/* Earnings List */}
      {earnings.length > 0 && (
      <div className="earnings-section">
        <Card>
          <div className="earnings-table">
            <div className="earnings-header-row">
              <div className="earnings-col-1">{tg.colDescription}</div>
              <div className="earnings-col-2">{tg.colDate}</div>
              <div className="earnings-col-3">{tg.colValue}</div>
              <div className="earnings-col-4">{tg.colStatus}</div>
            </div>
            {earnings.map((earning) => (
              <div key={earning.id}>
                <div
                  className="earnings-row"
                  onClick={() => toggleExpand(earning.id)}
                >
                  <div className="earnings-col-1">
                    <div className="earnings-title">{earning.descricao}</div>
                  </div>
                  <div className="earnings-col-2">
                    <p className="earnings-text">{earning.data}</p>
                  </div>
                  <div className="earnings-col-3">
                    <p className="earnings-text earnings-amount">{earning.valor}</p>
                  </div>
                  <div className="earnings-col-4">
                    <div className="earnings-status">
                      <Badge tone={getStatusBadgeTone(earning.status)}>
                        {earning.status}
                      </Badge>
                      <span
                        className="earnings-chevron"
                        role="img"
                        aria-label={expandedId === earning.id ? tg.closeDetails : tg.openDetails}
                      >
                        <Icon name={expandedId === earning.id ? 'chevron-up' : 'chevron-down'} size={14} />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === earning.id && (
                  <div className="earnings-details">
                    <div className="earnings-details-content">
                      <div className="detail-row">
                        <span className="detail-label">{tg.detailId}</span>
                        <span className="detail-value">{earning.id}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{tg.detailDescription}</span>
                        <span className="detail-value">{earning.descricao}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{tg.detailDate}</span>
                        <span className="detail-value">{earning.data}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{tg.detailValue}</span>
                        <span className="detail-value detail-amount">{earning.valor}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{tg.detailStatus}</span>
                        <span className="detail-value">
                          <Badge tone={getStatusBadgeTone(earning.status)}>
                            {earning.status}
                          </Badge>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
      )}
    </div>
  );
};
