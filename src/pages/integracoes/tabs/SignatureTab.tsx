import React from 'react';
import { SIGNATURE_PROVIDERS, type PanelProps } from '../registry';
import { UnsupportedPanel } from './UnsupportedPanel';

/**
 * Aba de assinatura genérica. Mesmo esquema da `PaymentTab`: o `name` do broker ativo vem do
 * backend e faz o inspecta-messenger — `name="autentique"` renderiza `<AutentiquePanel>`. Nome
 * desconhecido/`mock` → `<UnsupportedPanel>`.
 */
export const SignatureTab: React.FC<{ name: string } & PanelProps> = ({ name, status, q }) => {
  const provider = SIGNATURE_PROVIDERS[(name ?? '').toLowerCase()];
  if (!provider) return <UnsupportedPanel kind="signature" name={name} />;
  const { Panel } = provider;
  return <Panel status={status} q={q} />;
};
