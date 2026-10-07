import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/** Resposta de GET /v1/pleno/sync/{recursoTipo}/{recursoId} (inspecta-api, leitura). */
export interface PlenoSyncState {
  status: 'pendente' | 'sincronizado' | 'erro';
  externalId: string | null;
  erro: string | null;
  ultimoSync: string | null;
  origem: 'espelho' | 'manual';
}

export type PlenoRecurso = 'imobiliaria' | 'vistoriador' | 'imovel' | 'solicitacao';

/**
 * Estado do espelho Pleno de um recurso. `enabled` fica falso enquanto não há id
 * (ex.: logo após criar, antes do refetch da lista). 404 = ainda não enfileirado.
 *
 * `opts.enabled` (default true): permite ao chamador adiar a query — usado nas
 * listagens para só buscar quando a linha está expandida, evitando um leque de
 * N requests. `opts.poll` (default true): quando false, não re-busca a cada 15s
 * mesmo com status `pendente` (contexto de lista, onde há muitas instâncias).
 */
export function usePlenoSync(
  tipo: PlenoRecurso,
  id: string | null | undefined,
  opts?: { enabled?: boolean; poll?: boolean },
) {
  const poll = opts?.poll ?? true;
  return useQuery({
    queryKey: ['pleno-sync', tipo, id],
    queryFn: async (): Promise<PlenoSyncState | null> => {
      try {
        return await apiClient.request<PlenoSyncState>(`/v1/pleno/sync/${tipo}/${id}`);
      } catch {
        return null; // sem vínculo ainda
      }
    },
    enabled: !!id && (opts?.enabled ?? true),
    staleTime: 1000 * 20,
    refetchInterval: (q) =>
      poll && (q.state.data as PlenoSyncState | null)?.status === 'pendente' ? 1000 * 15 : false,
  });
}

/** Linha do painel de integração Pleno (GET /v1/pleno/sync). */
export interface PlenoSyncRow {
  id: string;
  recursoTipo: PlenoRecurso;
  recursoId: string;
  /** Nome legível do recurso (endereço do imóvel, razão social, etc.) — null se não resolveu. */
  recursoNome?: string | null;
  status: 'pendente' | 'sincronizado' | 'erro';
  externalId: string | null;
  erro: string | null;
  ultimoSync: string | null;
  origem: 'espelho' | 'manual';
}

interface Paged<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

/** Painel de sincronização Pleno (admin). `status` vazio = todos. */
export function usePlenoSyncList(status: string, page = 0, size = 30, q = '') {
  return useQuery({
    queryKey: ['pleno-sync-list', status, page, size, q],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), size: String(size) });
      if (status) qs.set('status', status);
      if (q.trim()) qs.set('q', q.trim());
      return apiClient.request<Paged<PlenoSyncRow>>(`/v1/pleno/sync?${qs.toString()}`);
    },
  });
}

export type AutentiqueStatus = 'pendente' | 'assinado' | 'recusado';
export type AbacatePayStatus = 'criando' | 'pendente' | 'pago' | 'falhou' | 'estornado';

export interface AutentiqueRow {
  id: string;
  nome: string;
  email: string;
  status: AutentiqueStatus;
  externalDocumentId: string | null;
  externalSignerId: string | null;
  criadoEm: string;
  assinadoEm: string | null;
  documentoTipo: string;
  documentoId: string;
}

export interface AbacatePayRow {
  id: string;
  solicitacaoId: string;
  provider: string;
  externalId: string | null;
  status: AbacatePayStatus;
  valor: number;
  checkoutUrl: string | null;
  criadoEm: string;
}

export function useAutentiqueList(status: string, page = 0, q = '', size = 30) {
  return useQuery({
    queryKey: ['integracao-autentique', status, page, size, q],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), size: String(size) });
      if (status) qs.set('status', status);
      if (q.trim()) qs.set('q', q.trim());
      return apiClient.request<Paged<AutentiqueRow>>(`/v1/integracoes/autentique?${qs.toString()}`);
    },
  });
}

export function useAbacatePayList(status: string, page = 0, q = '', size = 30) {
  return useQuery({
    queryKey: ['integracao-abacatepay', status, page, size, q],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), size: String(size) });
      if (status) qs.set('status', status);
      if (q.trim()) qs.set('q', q.trim());
      return apiClient.request<Paged<AbacatePayRow>>(`/v1/integracoes/abacatepay?${qs.toString()}`);
    },
  });
}

/** Botão "re-tentar espelhar" do painel. */
export function usePlenoSyncRetry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.request<PlenoSyncRow>(`/v1/pleno/sync/${id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pleno-sync-list'] });
      qc.invalidateQueries({ queryKey: ['pleno-sync'] });
    },
  });
}
