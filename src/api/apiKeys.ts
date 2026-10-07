import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { newIdempotencyKey } from '../utils/idempotency';

/** Metadados de uma API key (GET /v1/api-keys) — nunca inclui hash nem plaintext. */
export interface ApiKeyInfo {
  id: string;
  /** `••••1a2b` — 4 últimos dígitos do secret. O plaintext só volta uma vez, no POST. */
  mascara: string;
  imobiliariaId: string | null;
  escopos: string[];
  criadoEm: string;
  expiraEm: string;
  revogado: boolean;
  expirada: boolean;
}

/** Resposta de POST /v1/api-keys — o plaintext (`apiKey`) só vem aqui, uma vez. */
export interface CreatedApiKey {
  id: string;
  apiKey: string;
  mascara: string;
  imobiliariaId: string;
  expiraEm: string;
  aviso: string;
}

export interface CreateApiKeyRequest {
  imobiliariaId: string;
  escopos: string[];
  /** ISO-8601 no futuro (obrigatório — invariante de auth). */
  expiraEm: string;
}

export function useApiKeys(imobiliariaId?: string) {
  const qs = imobiliariaId ? `?imobiliariaId=${imobiliariaId}` : '';
  return useQuery({
    queryKey: ['api-keys', imobiliariaId ?? 'all'],
    queryFn: () => apiClient.request<ApiKeyInfo[]>(`/v1/api-keys${qs}`),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...body }: CreateApiKeyRequest & { idempotencyKey?: string }) =>
      apiClient.request<CreatedApiKey>('/v1/api-keys', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': idempotencyKey ?? newIdempotencyKey() },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.request<void>(`/v1/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}
