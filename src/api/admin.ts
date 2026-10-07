import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * API types for the Admin module.
 * Matches backend DTOs exactly (UsuarioResponse / ImobiliariaResponse) — no
 * speculative fields the backend doesn't have.
 */

export type UsuarioPerfil = 'admin' | 'suporte' | 'imob_gerencia' | 'imob_operacao' | 'vistoriador' | 'cliente';
export type UsuarioStatus = 'convidado' | 'ativo' | 'inativo';

/** Usuario — GET /v1/usuarios (UsuarioResponse, inspecta-api). */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: UsuarioPerfil;
  status: UsuarioStatus;
  imobiliariaId: string | null;
  /** false quando o convite nunca foi aceito (sem senha). Ausente em payloads antigos. */
  senhaDefinida?: boolean;
  criadoEm: string;
}

export interface InviteRequest {
  email: string;
  nome: string;
  perfil: UsuarioPerfil;
  /** V25: vínculos de imobiliária. O backend usa o 1º como primária. */
  imobiliariaIds?: string[];
}

/** Imobiliaria — GET /v1/imobiliarias (ImobiliariaResponse, inspecta-core). */
export interface Imobiliaria {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  ativa: boolean;
  pix?: string | null;
  emailFinanceiro?: string | null;
  telefone?: string | null;
  /** Vínculo explícito a um template PDF (id de pdf_templates). null = padrão/global. */
  pdfTemplateId?: string | null;
  /** Endereço próprio da imobiliária (mesma convenção do imóvel). O inspecta-api já devolve
   *  estes 5 campos em create/update/get. Não são espelhados para a Pleno. */
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cidadeId?: string | null;
}

/** Body accepted by POST /v1/imobiliarias (CreateImobiliariaRequest). */
export interface CreateImobiliariaRequest {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  pix?: string;
  emailFinanceiro?: string;
  telefone?: string;
  /** Endereço próprio da imobiliária — `endereco` e `cidadeId` obrigatórios pela UI,
   *  `cep`/`numero`/`complemento` opcionais. Não vão para o payload de espelhamento Pleno. */
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  cidadeId?: string;
  /** cadastro externo — cli_codigo de uma imobiliária que já existe na Pleno. */
  plenoIdExterno?: string;
  /** Biletagem definida no wizard (step Pagamento). */
  contrato?: {
    modo: 'faixa' | 'percentual';
    percentual?: number | null;
    percentualMinimo?: number | null;
    grupos?: { servicoId: string; percentual?: number | null; percentualMinimo?: number | null }[];
    faixas?: {
      servicoId: string;
      faixaId: string;
      valorSemMobilia: number | null;
      valorComMobilia: number | null;
      paStepMetragem?: number | null;
      paStepValor?: number | null;
    }[];
  };
}

/**
 * Paginated response wrapper
 */
interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Hook: useUsuarios — List users with optional pagination and filters.
 * A visibilidade real é decidida pelo backend (tenant-scoping, T2.3): IMOB_GERENCIA só
 * recebe gerência/operação da própria imobiliária, não importa o `perfil` pedido.
 * Busca (`q`) e `status` também filtram no banco — senão a paginação mente o total.
 */
export function useUsuarios(filters?: {
  page?: number;
  size?: number;
  perfil?: UsuarioPerfil;
  status?: UsuarioStatus;
  q?: string;
}) {
  const params = new URLSearchParams();
  params.append('page', String(filters?.page ?? 0));
  params.append('size', String(filters?.size ?? 50));
  if (filters?.perfil) params.append('perfil', filters.perfil);
  if (filters?.status) params.append('status', filters.status);
  const q = filters?.q?.trim();
  if (q) params.append('q', q);

  return useQuery({
    queryKey: ['usuarios', filters],
    queryFn: async () => {
      const response = await apiClient.request<PagedResponse<Usuario>>(
        `/v1/usuarios?${params.toString()}`
      );
      return response;
    },
    retry: 1,
  });
}

/**
 * Hook: useImobiliarias — List all agencies (imobiliárias)
 */
export function useImobiliarias(
  filters?: { page?: number; size?: number },
  options?: { enabled?: boolean }
) {
  const params = new URLSearchParams();
  params.append('page', String(filters?.page ?? 0));
  params.append('size', String(filters?.size ?? 50));

  return useQuery({
    queryKey: ['imobiliarias', filters],
    queryFn: async () => {
      const response = await apiClient.request<PagedResponse<Imobiliaria>>(
        `/v1/imobiliarias?${params.toString()}`
      );
      return response;
    },
    enabled: options?.enabled ?? true,
    retry: 1,
  });
}

/**
 * Hook: useImobiliaria — Fetch a single agency by ID
 */
export function useImobiliaria(id: string | null) {
  return useQuery({
    queryKey: ['imobiliaria', id],
    queryFn: async () => {
      if (!id) return null;
      return apiClient.request<Imobiliaria>(`/v1/imobiliarias/${id}`);
    },
    enabled: !!id,
    retry: 1,
  });
}

// useCidades() lives in api/imoveis.ts — the single canonical hook (flat Cidade[], key
// ['cidades']), imported from there by Admin.tsx.

/**
 * Hook: useInviteUsuario — Invite a new user
 */
export function useInviteUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteRequest) => {
      return apiClient.request<void>('/v1/usuarios', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate usuarios list to refetch
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

/**
 * Hook: useResendInvite — Resend the invite email for a user with status='convidado'
 */
export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (usuarioId: string) => {
      return apiClient.request<void>(`/v1/usuarios/${usuarioId}/reenviar-convite`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      // Invalidate usuarios list to refetch
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

/** P1: atualização parcial de imobiliária (dados financeiros + toggle ativa). */
export function useUpdateImobiliaria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<{
      razaoSocial: string; nomeFantasia: string; pix: string; emailFinanceiro: string; telefone: string; ativa: boolean;
      cep: string | null; endereco: string | null; numero: string | null; complemento: string | null; cidadeId: string | null;
      /** UUID nulo (`00000000-0000-0000-0000-000000000000`) = limpar o vínculo (volta ao template global); qualquer outro uuid vincula essa linha de pdf_templates. */
      pdfTemplateId: string;
    }>) => apiClient.request<Imobiliaria>(`/v1/imobiliarias/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['imobiliarias'] }),
  });
}

/**
 * Define/limpa só o template de laudo de uma imobiliária. Endpoint dedicado (ADMIN + SUPORTE)
 * — separado do PATCH, que é ADMIN-only e cobre o cadastro inteiro.
 * `pdfTemplateId`: UUID nulo (`00000000-0000-0000-0000-000000000000`) limpa o vínculo; qualquer
 * outro uuid vincula essa linha de pdf_templates.
 */
export function useSetImobiliariaPdfTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pdfTemplateId }: { id: string; pdfTemplateId: string }) =>
      apiClient.request<Imobiliaria>(`/v1/imobiliarias/${id}/pdf-template`, {
        method: 'PUT',
        body: JSON.stringify({ pdfTemplateId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['imobiliarias'] }),
  });
}

/** P1: ativar/desativar usuário e trocar perfil. */
export function usePatchUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; status?: UsuarioStatus; perfil?: UsuarioPerfil; nome?: string; imobiliariaId?: string }) =>
      apiClient.request<void>(`/v1/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

/** P1: vínculos de imobiliária de um usuário (V25). */
export function useUsuarioVinculos(usuarioId: string | null) {
  return useQuery({
    queryKey: ['usuario-vinculos', usuarioId],
    queryFn: () => apiClient.request<string[]>(`/v1/usuarios/${usuarioId}/imobiliarias`),
    enabled: !!usuarioId,
  });
}

export function useAddVinculo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, imobiliariaId }: { usuarioId: string; imobiliariaId: string }) =>
      apiClient.request<void>(`/v1/usuarios/${usuarioId}/imobiliarias/${imobiliariaId}`, { method: 'POST' }),
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['usuario-vinculos', v.usuarioId] }),
  });
}

export function useRemoveVinculo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, imobiliariaId }: { usuarioId: string; imobiliariaId: string }) =>
      apiClient.request<void>(`/v1/usuarios/${usuarioId}/imobiliarias/${imobiliariaId}`, { method: 'DELETE' }),
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['usuario-vinculos', v.usuarioId] }),
  });
}

/**
 * Hook: useCreateImobiliaria — Create a new agency (imobiliária)
 */
export function useCreateImobiliaria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idempotencyKey, ...data }: CreateImobiliariaRequest & { idempotencyKey?: string }) => {
      return apiClient.request<Imobiliaria>('/v1/imobiliarias', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      });
    },
    onSuccess: () => {
      // Invalidate imobiliarias list to refetch
      queryClient.invalidateQueries({ queryKey: ['imobiliarias'] });
    },
  });
}
