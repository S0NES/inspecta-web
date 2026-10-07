import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/DataDisplay';
import { solicitacaoIdFromUrl } from '../../utils/pagamentoReturn';
import { useTranslation, fmt } from '../../i18n';
import './Pagamento.css';

/**
 * Landing de `returnUrl` do provedor (`/pagamento/retorno`) — o usuário voltou
 * do checkout sem concluir ("carrinho abandonado"). Rota standalone: é aberta
 * por redirect do provedor, então roda fora do shell e sem exigir sessão.
 *
 * O id da solicitação chega em `?solicitacao=` (aceitamos também `id` /
 * `externalId`, caso o provedor troque o nome do parâmetro).
 */
export const PagamentoRetorno: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { t } = useTranslation();
  const solicitacaoId = solicitacaoIdFromUrl(search);

  const retomarPagamento = () => {
    navigate(solicitacaoId ? `/solicitacoes/${solicitacaoId}/pagar` : '/requests');
  };

  return (
    <div className="pagamento-standalone">
      <Card className="pagamento-card">
        <h1 className="type-h2">{t.payment.retorno.title}</h1>
        <p className="pagamento-subtitle">
          {t.payment.retorno.subtitlePrefix}
          {solicitacaoId ? fmt(t.payment.retorno.solInline, { id: solicitacaoId }) : ''}{' '}
          {t.payment.retorno.subtitleSuffix}
        </p>
        <div className="pagamento-actions">
          <Button variant="primary" onClick={retomarPagamento}>
            {solicitacaoId ? t.payment.retorno.resume : t.payment.viewRequests}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            {t.payment.retorno.goHome}
          </Button>
        </div>
      </Card>
    </div>
  );
};
