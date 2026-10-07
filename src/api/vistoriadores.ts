import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/** VistoriadorResponse (inspecta-api). `dadosPagamento` NÃO é exposto — nunca chega aqui. */
export interface Vistoriador {
  id: string;
  usuarioId: string;
  cidades: string[] | null;
  latBase: number | null;
  lngBase: number | null;
  distanciaMaxKm: number | null;
  plenoId: string | null;
  ativo: boolean;
}

export function useVistoriadores() {
  return useQuery({
    queryKey: ['vistoriadores'],
    queryFn: () => apiClient.request<Vistoriador[]>('/v1/vistoriadores'),
  });
}

export function usePatchVistoriador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<{
      ativo: boolean; cidades: string[]; distanciaMaxKm: number; latBase: number; lngBase: number;
    }>) => apiClient.request<Vistoriador>(`/v1/vistoriadores/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vistoriadores'] }),
  });
}

/** Slot semanal de disponibilidade (0 = domingo … 6 = sábado). */
export interface DisponibilidadeSlot {
  id: string;
  vistoriadorId: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}

/** Exceção: folga (`ferias`) ou bloqueio pontual (`bloqueio`). */
export interface Excecao {
  id: string;
  vistoriadorId: string;
  tipo: 'ferias' | 'bloqueio';
  dataInicio: string;
  dataFim: string;
}

export function useDisponibilidade(vistoriadorId: string | null) {
  return useQuery({
    queryKey: ['disponibilidade', vistoriadorId],
    queryFn: () => apiClient.request<DisponibilidadeSlot[]>(`/v1/vistoriadores/${vistoriadorId}/disponibilidade`),
    enabled: !!vistoriadorId,
  });
}

export function useExcecoes(vistoriadorId: string | null) {
  return useQuery({
    queryKey: ['excecoes', vistoriadorId],
    queryFn: () => apiClient.request<Excecao[]>(`/v1/vistoriadores/${vistoriadorId}/excecoes`),
    enabled: !!vistoriadorId,
  });
}

export function useAddSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vistoriadorId, ...body }: { vistoriadorId: string; diaSemana: number; horaInicio: string; horaFim: string }) =>
      apiClient.request(`/v1/vistoriadores/${vistoriadorId}/disponibilidade`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['disponibilidade', v.vistoriadorId] }),
  });
}

export function useRemoveSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vistoriadorId, slotId }: { vistoriadorId: string; slotId: string }) =>
      apiClient.request(`/v1/vistoriadores/${vistoriadorId}/disponibilidade/${slotId}`, { method: 'DELETE' }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['disponibilidade', v.vistoriadorId] }),
  });
}

export function useAddExcecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vistoriadorId, ...body }: { vistoriadorId: string; tipo: 'ferias' | 'bloqueio'; dataInicio: string; dataFim: string }) =>
      apiClient.request(`/v1/vistoriadores/${vistoriadorId}/excecoes`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['excecoes', v.vistoriadorId] }),
  });
}

export function useRemoveExcecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vistoriadorId, excecaoId }: { vistoriadorId: string; excecaoId: string }) =>
      apiClient.request(`/v1/vistoriadores/${vistoriadorId}/excecoes/${excecaoId}`, { method: 'DELETE' }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['excecoes', v.vistoriadorId] }),
  });
}
