import React from 'react';
import { Card } from '../../../components/shared/DataDisplay';
import { useTranslation, fmt } from '../../../i18n';

/**
 * Fallback quando o backend reporta um provedor de pagamento/assinatura sem componente de aba
 * correspondente (ex.: `PAYMENT_PROVIDER=mock` ou um provedor novo ainda não integrado no front).
 */
export const UnsupportedPanel: React.FC<{ kind: 'payment' | 'signature'; name: string }> = ({
  kind,
  name,
}) => {
  const { t } = useTranslation();
  return (
    <Card>
      <p className="intg-empty">{fmt(t.integracoes.unsupported[kind], { name: name || '—' })}</p>
    </Card>
  );
};
