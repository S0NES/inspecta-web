import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/DataDisplay';
import { useCobranca } from '../../api/pagamento';
import { solicitacaoIdFromUrl } from '../../utils/pagamentoReturn';
import { useTranslation, fmt } from '../../i18n';
import './Pagamento.css';

/**
 * Landing de `completionUrl` do provedor (`/pagamento/concluido`) — página de
 * agradecimento. Faz polling em `GET /v1/solicitacoes/{id}/pagamento` até o
 * status virar `pago` (o webhook do provedor é assíncrono), então oferece o
 * link de volta para a solicitação. Rota standalone (aberta por redirect).
 */
export const PagamentoConcluido: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { t } = useTranslation();
  const solicitacaoId = solicitacaoIdFromUrl(search);
  const cobranca = useCobranca(solicitacaoId ?? undefined, { pollMs: 3000 });

  const pago = cobranca.data?.status === 'pago' || cobranca.data?.paymentStatus === 'pago';

  const verSolicitacao = () => {
    navigate(solicitacaoId ? `/inspections/${solicitacaoId}` : '/requests');
  };

  return (
    <div className="pagamento-standalone">
      <Card className="pagamento-card">
        {pago ? (
          <>
            <h1 className="type-h2">{t.payment.concluido.paidTitle}</h1>
            <p className="pagamento-subtitle">
              {t.payment.concluido.paidSubtitlePrefix}
              {solicitacaoId ? fmt(t.payment.concluido.paidSubtitleReqPart, { id: solicitacaoId }) : ''}
              {t.payment.concluido.paidSubtitleSuffix}
            </p>
            <div className="pagamento-actions">
              <Button variant="primary" onClick={verSolicitacao}>{t.payment.viewRequest}</Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="type-h2">{t.payment.concluido.confirmingTitle}</h1>
            <p className="pagamento-subtitle">{t.payment.concluido.confirmingSubtitle}</p>
            <p className="pagamento-spinner" role="status">{t.payment.concluido.waitingProvider}</p>
            <div className="pagamento-actions">
              <Button variant="ghost" onClick={verSolicitacao}>
                {solicitacaoId ? t.payment.viewRequest : t.payment.concluido.viewRequestOrList}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
