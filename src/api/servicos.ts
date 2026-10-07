import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Produto (ex.: "Elegance") — agrupa N Serviços (M:N).
 * Catálogo global; criar/editar só admin/suporte. Consumido pela tela Tipagem
 * (aba "Produtos") e pela biletagem da imobiliária.
 *
 * Contrato (Agente B):
 *   GET    /v1/servicos                   -> ServicoView[]
 *   POST   /v1/servicos   { nome, tipoServicoIds:string[] }           -> 201 ServicoView
 *   PATCH  /v1/servicos/{id} { nome?, ativo?, tipoServicoIds?:string[] } -> 200 ServicoView
 *   DELETE /v1/servicos/{id}                                          -> 204
 *   PATCH  /v1/servicos/{servicoId}/tipos/{tipoServicoId}/pleno-codigo
 *          { codigo: number|null } -> 200 ServicoView (404 se o vínculo não existir)
 */

export interface ServicoTipoRef {
  id: string;
  nome: string;
  plenoTipVisCodigo: number | null;
}

export interface ServicoView {
  id: string;
  nome: string;
  ativo: boolean;
  tipos: ServicoTipoRef[];
}

export function useServicos() {
  return useQuery({
    queryKey: ['servicos'],
    queryFn: () => apiClient.request<ServicoView[]>('/v1/servicos'),
  });
}

export function useCreateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nome: string; tipoServicoIds: string[] }) =>
      apiClient.request<ServicoView>('/v1/servicos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servicos'] }),
  });
}

export function usePatchServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; nome?: string; ativo?: boolean; tipoServicoIds?: string[] }) =>
      apiClient.request<ServicoView>(`/v1/servicos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servicos'] }),
  });
}

export function useSetTipoPlenoCodigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoId, tipoServicoId, codigo }: { servicoId: string; tipoServicoId: string; codigo: number | null }) =>
      apiClient.request<ServicoView>(`/v1/servicos/${servicoId}/tipos/${tipoServicoId}/pleno-codigo`, {
        method: 'PATCH',
        body: JSON.stringify({ codigo }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servicos'] }),
  });
}

export function useDeleteServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.request<void>(`/v1/servicos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servicos'] }),
  });
}
