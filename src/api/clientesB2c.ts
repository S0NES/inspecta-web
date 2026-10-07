import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * API do módulo Cliente B2C (Fase 1 — telas 1-2: wizard + listagem).
 * Contrato combinado com o backend (inspecta-api), implementado em paralelo:
 *  - POST   /v1/clientes-b2c                — cria + envia convite (fire-and-forget, 201 sem corpo)
 *  - GET    /v1/clientes-b2c                — Page<ClienteB2cResponse>
 *  - PATCH  /v1/clientes-b2c/{id}            — parcial (nome/telefone/cidadeId/clientServices)
 *  - POST   /v1/clientes-b2c/{id}/inativar   — 204, seta o usuário subjacente como inativo
 * Reenvio de convite reusa o endpoint já existente de usuários (ver `useResendInvite`
 * em `api/admin.ts`) — não duplicado aqui; ver TODO no componente que consome.
 */

export type ClienteB2cStatus = 'convidado' | 'ativo' | 'inativo';

/** ClienteB2c — GET /v1/clientes-b2c (ClienteB2cResponse, inspecta-api). */
export interface ClienteB2c {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  cidadeId: string;
  clientServices: string[];
  status: ClienteB2cStatus;
  quantidadeVistorias: number;
  criadoEm: string;
}

export interface CreateClienteB2cRequest {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  cidadeId: string;
  clientServices: string[];
}

export interface PatchClienteB2cRequest {
  id: string;
  nome?: string;
  telefone?: string;
  cidadeId?: string;
  clientServices?: string[];
}

interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/** Lista paginada de clientes B2C — busca/cidade/status filtram no banco (mesma cautela de useUsuarios). */
export function useClientesB2c(filters?: {
  page?: number;
  size?: number;
  q?: string;
  cidadeId?: string;
  status?: ClienteB2cStatus;
}) {
  const params = new URLSearchParams();
  params.append('page', String(filters?.page ?? 0));
  params.append('size', String(filters?.size ?? 20));
  const q = filters?.q?.trim();
  if (q) params.append('q', q);
  if (filters?.cidadeId) params.append('cidadeId', filters.cidadeId);
  if (filters?.status) params.append('status', filters.status);

  return useQuery({
    queryKey: ['clientes-b2c', filters],
    queryFn: () => apiClient.request<PagedResponse<ClienteB2c>>(`/v1/clientes-b2c?${params.toString()}`),
    retry: 1,
  });
}

/** Um cliente B2C por id — usado para hidratar o wizard em modo edição. */
export function useClienteB2c(id: string | null) {
  return useQuery({
    queryKey: ['cliente-b2c', id],
    queryFn: () => apiClient.request<ClienteB2c>(`/v1/clientes-b2c/${id}`),
    enabled: !!id,
    retry: 1,
  });
}

/**
 * O cliente B2C logado (role CLIENTE) — GET /v1/clientes-b2c/me. Usado pelo wizard de
 * solicitação (Página 4): dá `cidadeId` (trava a cidade do imóvel) e `clientServices`
 * (filtra os cards de serviço selecionáveis).
 */
export function useMeuClienteB2c() {
  return useQuery({
    queryKey: ['cliente-b2c-me'],
    queryFn: () => apiClient.request<ClienteB2c>('/v1/clientes-b2c/me'),
    retry: 1,
  });
}

/** Cria o cliente e dispara o convite — 201 sem corpo; a lista refaz o GET. */
export function useCreateClienteB2c() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClienteB2cRequest) =>
      apiClient.request<void>('/v1/clientes-b2c', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes-b2c'] }),
  });
}

/** PATCH parcial — nome/telefone/cidadeId/clientServices. E-mail e CPF são imutáveis (identidade). */
export function usePatchClienteB2c() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: PatchClienteB2cRequest) =>
      apiClient.request<ClienteB2c>(`/v1/clientes-b2c/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes-b2c'] }),
  });
}

/** Inativa o cliente (seta o usuário subjacente como inativo) — 204 sem corpo. */
export function useInativarClienteB2c() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.request<void>(`/v1/clientes-b2c/${id}/inativar`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes-b2c'] }),
  });
}

// Reenviar convite: reusa POST /v1/usuarios/{usuarioId}/reenviar-convite (useResendInvite,
// api/admin.ts) — o mesmo endpoint da tela Usuários. NÃO reimplementado aqui.
// Usa `usuarioId` (o usuário subjacente), não `id` (o cliente B2C).
