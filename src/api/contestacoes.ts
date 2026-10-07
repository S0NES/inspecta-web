import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Contestação — GET /v1/contestacoes (inspecta-api). Modela uma disputa pontual sobre um
 * ponto específico de um laudo (autor, texto, status, resolução). Não existe conceito de
 * "nota"/"cobertura"/checklist no domínio real — não inventar esses campos aqui.
 */
export type ContestacaoStatus = 'aberta' | 'aceita' | 'rejeitada';

export interface Contestacao {
  id: string;
  laudoId: string;
  nodeUuid: string;
  autorId: string | null;
  texto: string;
  status: ContestacaoStatus;
  resolucao: string | null;
  criadoEm: string;
}

interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export function useContestacoes(filters?: { vistoriadorId?: string; solicitacaoId?: string; page?: number; size?: number }) {
  const params = new URLSearchParams();
  params.append('page', String(filters?.page ?? 0));
  params.append('size', String(filters?.size ?? 50));
  if (filters?.vistoriadorId) params.append('vistoriadorId', String(filters.vistoriadorId));
  if (filters?.solicitacaoId) params.append('solicitacaoId', String(filters.solicitacaoId));

  return useQuery({
    queryKey: ['contestacoes', filters],
    queryFn: async () => apiClient.request<PagedResponse<Contestacao>>(`/v1/contestacoes?${params.toString()}`),
    retry: 1,
  });
}

export function useCriarContestacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ laudoId, texto, nodeUuid }: { laudoId: string; texto: string; nodeUuid?: string }) =>
      apiClient.request<Contestacao>('/v1/contestacoes', {
        method: 'POST',
        body: JSON.stringify({ laudoId, texto, ...(nodeUuid ? { nodeUuid } : {}) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contestacoes'] });
    },
  });
}

export function useResolverContestacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, aceitar, resolucao }: { id: string; aceitar: boolean; resolucao: string }) =>
      apiClient.request<void>(`/v1/contestacoes/${id}/resolver`, {
        method: 'POST',
        body: JSON.stringify({ aceitar, resolucao }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contestacoes'] });
    },
  });
}
