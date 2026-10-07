import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/** Ambiente de um imóvel (ex.: "Sala", "Cozinha") — GET/POST /v1/imoveis/{imovelId}/ambientes. */
export interface Ambiente {
  id: string;
  imovelId: string;
  nome: string;
  tipo: string | null;
  ordem: number;
}

export interface CreateAmbienteRequest {
  nome: string;
  tipo?: string | null;
  /** Posição na lista do imóvel; se omitido, o backend define pela ordem de criação. */
  ordem?: number;
}

export function useAmbientes(imovelId: string | null | undefined) {
  return useQuery({
    queryKey: ['ambientes', imovelId],
    queryFn: () => apiClient.request<Ambiente[]>(`/v1/imoveis/${imovelId}/ambientes`),
    enabled: !!imovelId,
  });
}

export function useCreateAmbiente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imovelId, ...data }: { imovelId: string } & CreateAmbienteRequest) =>
      apiClient.request<Ambiente>(`/v1/imoveis/${imovelId}/ambientes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['ambientes', v.imovelId] }),
  });
}

export function useDeleteAmbiente(imovelId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.request<void>(`/v1/ambientes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ambientes', imovelId] }),
  });
}

/** Foto de um ambiente — GET/POST /v1/ambientes/{ambienteId}/fotos. */
export interface Foto {
  id: string;
  ambienteId: string;
  arquivoId: string;
  ordem: number;
}

export function useFotos(ambienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['fotos', ambienteId],
    queryFn: () => apiClient.request<Foto[]>(`/v1/ambientes/${ambienteId}/fotos`),
    enabled: !!ambienteId,
  });
}

export interface UploadFotoRequest {
  ambienteId: string;
  file: File;
  ordem?: number;
}

/**
 * Upload de foto de um ambiente. O POST é multipart/form-data (o arquivo em si),
 * então usa `fetch` direto em vez de `apiClient.request` — igual a `useUpload`
 * (uploads genéricos de arquivo), que também não pode mandar o
 * `Content-Type: application/json` fixo do `apiClient`. O backend persiste o
 * arquivo, cria o `Arquivo` e o `Foto` (com o `arquivoId` resultante) numa
 * tacada só e devolve o `Foto` criado.
 */
export function useCreateFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ambienteId, file, ordem }: UploadFotoRequest) => {
      const formData = new FormData();
      formData.append('file', file);
      if (ordem != null) formData.append('ordem', String(ordem));

      const response = await fetch(`${API_BASE_URL}/v1/ambientes/${ambienteId}/fotos`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
      }

      return response.json() as Promise<Foto>;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['fotos', v.ambienteId] }),
  });
}

export function useDeleteFoto(ambienteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.request<void>(`/v1/fotos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fotos', ambienteId] }),
  });
}
