import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * API de configuração da Biletagem do Cliente B2C (Fase 1 — tela 3):
 *  - GET /v1/config/biletagem-cliente — configuração atual (inspecta-api, admin/suporte). Vem com
 *    `servicos` (o catálogo `b2c_service` ativo) para montar as abas sem round-trip extra.
 *  - PUT /v1/config/biletagem-cliente — substitui a config; envie só o array do `modo`
 *    ativo (o outro pode vir omitido/vazio — o backend troca o conjunto inteiro daquele modo).
 * Um único `modo` vale para todos os `b2c_service`; os valores são por serviço dentro do
 * modo escolhido, chaveados por `b2cServiceId` (substitui o antigo enum `clientService`).
 */

export type BiletagemClienteModo = 'percentual' | 'faixa';

export interface BiletagemClienteServico {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
}

export interface BiletagemClientePercentual {
  b2cServiceId: string;
  percentual: number;
  minimo: number | null;
}

/** `faixaReferenciaId` referencia o catálogo global `faixa_referencia` (1..5) — mesmo do B2B
 *  (ver `FAIXAS_REFERENCIA` em `api/contratos.ts`), aqui como `number` (SMALLINT no backend). */
export interface BiletagemClienteFaixa {
  b2cServiceId: string;
  faixaReferenciaId: number;
  valorSemMob: number;
  valorComMob: number;
}

export interface BiletagemClienteView {
  modo: BiletagemClienteModo;
  servicos: BiletagemClienteServico[];
  percentuais: BiletagemClientePercentual[];
  faixas: BiletagemClienteFaixa[];
}

export function useBiletagemCliente() {
  return useQuery({
    queryKey: ['biletagem-cliente'],
    queryFn: () => apiClient.request<BiletagemClienteView>('/v1/config/biletagem-cliente'),
    retry: 1,
  });
}

export function usePutBiletagemCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<BiletagemClienteView, 'servicos'>) =>
      apiClient.request<BiletagemClienteView>('/v1/config/biletagem-cliente', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['biletagem-cliente'] }),
  });
}
