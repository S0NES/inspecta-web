import React, { useState } from 'react';
import { useTranslation } from '../../i18n';

interface Props {
  /** URL do checkout hospedado do provedor (cartão). */
  url: string;
  /** Chamado ao abrir o checkout — o pai usa para ligar o polling de confirmação. */
  onOpen?: () => void;
}

/**
 * Checkout por cartão. O provedor (AbacatePay) só oferece checkout hospedado — sem fluxo transparente
 * de cartão nem componente embutível — e bloqueia embed por iframe; por isso o pagamento abre numa
 * janela própria e o inspecta-web acompanha a confirmação (polling feito por quem usa este componente).
 * Nunca coletamos dados de cartão aqui.
 */
export const CheckoutHospedado: React.FC<Props> = ({ url, onOpen }) => {
  const { t } = useTranslation();
  const tc = t.payment.checkoutHospedado;
  const [aberto, setAberto] = useState(false);

  return (
    <div className="pagamento-checkout-hospedado">
      <p className="pagamento-subtitle">{tc.description}</p>
      <div className="pagamento-actions">
        <a
          className="btn btn--primary btn--md"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { setAberto(true); onOpen?.(); }}
        >
          {tc.open}
        </a>
      </div>
      {aberto && <p className="pagamento-pix-meta" role="status">{tc.waiting}</p>}
    </div>
  );
};
