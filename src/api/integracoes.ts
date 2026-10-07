import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Provedores de integração ativos, resolvidos no backend a partir das mesmas envs/secrets que
 * ligam cada integração (`PAYMENT_PROVIDER`, `SIGNATURE_BROKER`, `PLENO_MODE`). O painel de
 * integrações usa isto para decidir qual componente de aba renderizar por nome — ex.:
 * `payment: "abacatepay"` → `<PaymentTab name="abacatepay">` → `<AbacatePayPanel>`.
 */
export interface IntegracoesConfig {
  /** "abacatepay" | "mock" | … */
  payment: string;
  /** "autentique" | "mock" | … */
  signature: string;
  /** "http" | "mock" */
  pleno: string;
}

/** GET /v1/integracoes/config (ADMIN/SUPORTE). Sem retry: backend antigo/403 cai no fallback do shell. */
export function useIntegracoesConfig() {
  return useQuery({
    queryKey: ['integracoes-config'],
    queryFn: () => apiClient.request<IntegracoesConfig>('/v1/integracoes/config'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
