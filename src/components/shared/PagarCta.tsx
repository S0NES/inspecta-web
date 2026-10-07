import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { podeExibirPagar } from '../../api/pagamento';
import { useTranslation } from '../../i18n';

/**
 * CTA "Pagar" para o detalhe da solicitação e para as linhas de lista/kanban.
 * Só aparece quando existe um `checkoutUrl` e o pagamento ainda não foi
 * concluído (`paymentStatus !== 'pago'`). Navega para `/solicitacoes/:id/pagar`.
 *
 * Os campos de pagamento vêm do read model de `GET /v1/solicitacoes` — o backend
 * pode servi-los soltos (`checkoutUrl` / `paymentStatus`) ou omiti-los enquanto
 * o checkout não existe; nesse caso o componente não renderiza nada.
 */
export const PagarCta: React.FC<{
  solicitacaoId: string;
  checkoutUrl?: string | null;
  paymentStatus?: string | null;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  className?: string;
}> = ({ solicitacaoId, checkoutUrl, paymentStatus, size = 'sm', variant = 'accent', className }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!podeExibirPagar({ checkoutUrl, paymentStatus })) return null;

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/solicitacoes/${solicitacaoId}/pagar`);
      }}
    >
      {t.payment.pay}
    </Button>
  );
};
