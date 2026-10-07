import { useQuery } from '@tanstack/react-query';
import { apiClient, type MeResponse } from './client';

export type { MeResponse };

/**
 * Hook: useMe — identidade do usuário logado (GET /v1/usuarios/me).
 * Diferente de `apiClient.me()` (que engole o erro e devolve null), aqui deixamos o
 * erro fluir para o React Query — a tela decide o fallback. `retry: 1` acompanha os
 * outros hooks do módulo.
 */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.request<MeResponse>('/v1/usuarios/me'),
    retry: 1,
  });
}
