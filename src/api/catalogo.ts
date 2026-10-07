import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/** Dados de referência administráveis: tipos de serviço e cidades (P0). */

export interface TipoServico {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Cidade {
  id: string;
  nome: string;
  uf: string;
  lat?: number | null;
  lng?: number | null;
}

interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/** Lista completa (inclui inativos) — para a tela de administração. */
export function useTiposServicoAdmin() {
  return useQuery({
    queryKey: ['tipos-servico', 'admin'],
    queryFn: () => apiClient.request<PagedResponse<TipoServico>>('/v1/tipos-servico?page=0&size=200'),
  });
}

export function useCreateTipoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) =>
      apiClient.request<TipoServico>('/v1/tipos-servico', {
        method: 'POST',
        body: JSON.stringify({ nome, ativo: true }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos-servico'] }),
  });
}

export function usePatchTipoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; nome?: string; ativo?: boolean }) =>
      apiClient.request<TipoServico>(`/v1/tipos-servico/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos-servico'] }),
  });
}

/** Imobiliárias que cobrem um tipo de serviço (via contratos ativos). */
export function useTipoServicoImobiliarias(tipoServicoId: string | null) {
  return useQuery({
    queryKey: ['tipo-servico-imobiliarias', tipoServicoId],
    queryFn: () => apiClient.request<string[]>(`/v1/contratos/servicos/${tipoServicoId}/imobiliarias`),
    enabled: !!tipoServicoId,
  });
}

export function useCreateCidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nome: string; uf: string; lat?: number | null; lng?: number | null }) =>
      apiClient.request<Cidade>('/v1/cidades', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cidades'] });
      qc.invalidateQueries({ queryKey: ['cidades-all'] });
    },
  });
}

/**
 * Exclui uma cidade cadastrada. O backend devolve 409 (mensagem amigável) quando
 * ainda há imóveis vinculados — nesse caso a cidade não pode ser removida.
 */
export function useDeleteCidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.request<void>(`/v1/cidades/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cidades'] });
      qc.invalidateQueries({ queryKey: ['cidades-all'] });
    },
  });
}
