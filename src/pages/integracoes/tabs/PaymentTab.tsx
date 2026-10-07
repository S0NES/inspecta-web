import React from 'react';
import { PAYMENT_PROVIDERS, type PanelProps } from '../registry';
import { UnsupportedPanel } from './UnsupportedPanel';

/**
 * Aba de pagamento genérica. Recebe do backend (`GET /v1/integracoes/config`) o `name` do
 * provedor ativo e faz o inspecta-messenger para o componente concreto — `name="abacatepay"` renderiza
 * `<AbacatePayPanel>`. Nome desconhecido/`mock` → `<UnsupportedPanel>`.
 */
export const PaymentTab: React.FC<{ name: string } & PanelProps> = ({ name, status, q }) => {
  const provider = PAYMENT_PROVIDERS[(name ?? '').toLowerCase()];
  if (!provider) return <UnsupportedPanel kind="payment" name={name} />;
  const { Panel } = provider;
  return <Panel status={status} q={q} />;
};
