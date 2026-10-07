import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

/** Arquivo — GET /v1/uploads (ArquivoResponse, inspecta-api). Metadados de um arquivo já persistido. */
export interface ArquivoResumo {
  id: string;
  mime: string;
  tamanho: number;
  criadoEm: string;
}

export function useArquivosPorDono(ownerType: string, ownerId: string | undefined) {
  return useQuery({
    queryKey: ['uploads', ownerType, ownerId],
    queryFn: async () =>
      apiClient.request<ArquivoResumo[]>(
        `/v1/uploads?ownerType=${encodeURIComponent(ownerType)}&ownerId=${ownerId}`
      ),
    enabled: !!ownerId,
  });
}
