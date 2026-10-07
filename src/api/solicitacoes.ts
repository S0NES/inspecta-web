import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from './client';
import { parsePaymentMeta, type PaymentMeta } from './pagamento';

/**
 * Solicitação — read model servido por GET /v1/solicitacoes.
 *
 * O inspecta-api já resolve endereço, tipo, vistoriador, data/hora, status e valor
 * (ver SolicitacaoQueryService), então a tela não precisa fazer nenhum join.
 */
export interface Solicitacao {
  id: string;
  solicitacaoId: string;
  endereco: string;
  imagem: string;
  tipo: string;
  vistoriador: string;
  data: string;
  hora: string;
  status: string;
  /** Preço cobrado formatado; nulo para o vistoriador (decisão de negócio — ver PrecoVisibilidadePolicy no inspecta-api). */
  valor: string | null;
  urgente: boolean;
  /**
   * Pagamento — o backend pode servir estes campos soltos no read model
   * (ou omiti-los enquanto o checkout não existe). Usados pelo CTA "Pagar"
   * na lista/kanban e no detalhe. Ver payment-flow-spec.md § "API contract".
   */
  paymentStatus?: string | null;
  checkoutUrl?: string | null;
  checkoutId?: string | null;
  checkoutReady?: boolean;
}

/**
 * Body aceito por POST /v1/solicitacoes.
 *
 * O vistoriador NÃO entra aqui: a atribuição é assíncrona, feita pelo inspecta-worker
 * a partir do evento `assignment.requested` publicado na criação.
 */
/** Uma pessoa da solicitação — quem assina o laudo. Vira signatário da assinatura. */
export interface SolicitacaoIntervenienteItem {
  papelSlug: string; // locador | locatario | fiador
  nome: string;
  cpf: string;
  email: string;
  /** Opcional — 10-11 dígitos. */
  telefone?: string | null;
  /** Marca a pessoa como acompanhante da vistoria (0+; opcional). */
  acompanhante?: boolean;
}

export interface CreateSolicitacaoRequest {
  /**
   * Opcional no fluxo B2B (D1): a solicitação é ancorada em Imobiliária → Imóvel,
   * não mais no Cliente. Quando informado, o backend valida que pertence à mesma
   * imobiliária do imóvel; quando ausente, é ignorado.
   */
  clienteId?: string | null;
  imovelId: string;
  urgente?: boolean;
  chavesRetirada?: string | null;
  chavesDevolucao?: string | null;
  /**
   * D2: aluguel/mobiliado passam a ser da solicitação (snapshot), não atributos
   * de verdade do imóvel. Obrigatórios quando o contrato da imobiliária é
   * `percentual`; opcionais caso contrário. Nível raiz — valem para todos os serviços.
   */
  valorAluguel?: number | null;
  mobiliado?: boolean;
  origem: 'painel' | 'portal' | 'api';
  servicos: Array<{
    tipoServicoId: string;
    basePercentual?: number | null;
    /** V3: data/hora desejada da vistoria deste serviço (ISO). */
    dataDesejada?: string | null;
  }>;
  /** ≥1 pessoa (nome/cpf/e-mail válidos). Substitui `acompanham`. */
  intervenientes: SolicitacaoIntervenienteItem[];
  /** cadastro externo — sol_codigo de uma solicitação que já existe na Pleno. */
  plenoIdExterno?: string | null;
  /**
   * Chave de idempotência gerada no cliente (ver utils/idempotency.ts) e reusada
   * em retry — impede criar duas solicitações se a resposta se perder. Vai no
   * header `Idempotency-Key`, nunca no corpo. Ver specs/tasks/T6.18.
   */
  idempotencyKey?: string;
}

/** Imóvel — GET /v1/imoveis */
export interface Imovel {
  id: string;
  imobiliariaId: string | null;
  cidadeId: string;
  endereco: string;
  cep: string | null;
  metragem: number;
  mobiliado: boolean;
  tipo: string | null;
  /** V3: valor do aluguel — base do cálculo de biletagem percentual. */
  valorAluguel?: number | null;
}

/** Cliente — GET /v1/clientes */
export interface Cliente {
  id: string;
  nome: string;
  cpfCnpj: string | null;
  email: string | null;
  telefone: string | null;
  /** A imobiliária dona do cliente — filtra os imóveis no wizard. Todo cliente tem uma. */
  imobiliariaId: string | null;
}

/** Papel de interveniente — GET /v1/interveniente-papeis (lookup só de leitura). */
export interface IntervenientePapel {
  slug: string;
  nome: string;
}

/** Tipo de serviço — GET /v1/tipos-servico */
export interface TipoServico {
  id: string;
  nome: string;
  ativo: boolean;
}

/** Envelope de paginação do Spring Data. */
export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

const EMPTY_PAGE = { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0, first: true, last: true };

function query(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Chaves de status aceitas por `GET /v1/solicitacoes?status=`. */
export type StatusKey =
  | 'solicitada'
  | 'atribuida'
  | 'agendada'
  | 'em_campo'
  | 'concluida'
  | 'cancelada';

export interface SolicitacaoFilters {
  q?: string;
  cidadeId?: string;
  urgente?: boolean;
  status?: StatusKey | '';
  /** Escopo por imobiliária (kanban/wizard). RLS já barra o que não é do tenant. */
  imobiliariaId?: string;
  page?: number;
  size?: number;
  /** `false` desliga a consulta (ex.: coluna de board não visível). Default: ligada. */
  enabled?: boolean;
}

/**
 * Lista solicitações já no formato de exibição.
 *
 * Todos os filtros vão para o servidor: filtrar no cliente só enxergava a página carregada,
 * o que dava contagem e paginação erradas assim que a lista passava de uma página.
 */
export function useSolicitacoes(filters?: SolicitacaoFilters) {
  const page = filters?.page ?? 0;
  const size = filters?.size ?? 20;
  const q = filters?.q?.trim() || undefined;
  const cidadeId = filters?.cidadeId;
  const urgente = filters?.urgente;
  const status = filters?.status || undefined;
  const imobiliariaId = filters?.imobiliariaId;

  return useQuery({
    queryKey: ['solicitacoes', { q, cidadeId, urgente, status, imobiliariaId, page, size }],
    queryFn: () =>
      apiClient.request<PagedResponse<Solicitacao>>(
        `/v1/solicitacoes${query({ q, cidadeId, urgente, status, imobiliariaId, page, size })}`
      ),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
    enabled: filters?.enabled ?? true,
  });
}

/** Contagens por status derivado — chaves de {@link StatusKey} mais `total`. */
export type SolicitacoesResumo = Record<StatusKey | 'total', number>;

/**
 * Resumo por status para os cartões do painel.
 *
 * Vem do mesmo caminho de consulta da listagem, então painel e lista nunca divergem.
 */
export function useSolicitacoesResumo(filters?: { q?: string; cidadeId?: string; urgente?: boolean }) {
  const q = filters?.q?.trim() || undefined;

  return useQuery({
    queryKey: ['solicitacoes-resumo', { q, cidadeId: filters?.cidadeId, urgente: filters?.urgente }],
    queryFn: () =>
      apiClient.request<SolicitacoesResumo>(
        `/v1/solicitacoes/resumo${query({ q, cidadeId: filters?.cidadeId, urgente: filters?.urgente })}`
      ),
    staleTime: 1000 * 30,
  });
}

/**
 * Resultado de `POST /v1/solicitacoes`. O `id` é lido de forma defensiva: a
 * resposta pode ser o `Solicitacao` direto (`{ id, ... }`) ou o wrapper
 * `{ solicitacao: { id, ... }, payment: { ... } }`. `payment` é sempre
 * normalizado por {@link parsePaymentMeta}.
 */
export interface CreateSolicitacaoResult {
  id: string;
  payment: PaymentMeta;
  /** Corpo cru da resposta, para call-sites que precisem de campos ainda não tipados. */
  raw: unknown;
}

/** Cria a solicitação e invalida a listagem. */
export function useCreateSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      idempotencyKey,
      ...body
    }: CreateSolicitacaoRequest): Promise<CreateSolicitacaoResult> => {
      const raw = await apiClient.request<Record<string, any>>('/v1/solicitacoes', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      });
      const sol = (raw?.solicitacao ?? raw ?? {}) as { id?: string };
      return { id: sol.id ?? '', payment: parsePaymentMeta(raw), raw };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
    },
  });
}

/**
 * Preview de preço (V3) — não cria nada.
 * `GET /v1/solicitacoes/preco-preview?imobiliariaId&tipoServicoId&metragem&mobiliado&valorAluguel`
 *   -> 200 { valor, repasse, faixaId }
 *   -> 422 { codigo, mensagem }  (contrato inativo, serviço não coberto, sem faixa/PA)
 * `imobiliariaId` é sempre a do imóvel.
 */
export interface PrecoPreview {
  valor: number;
  repasse: number;
  faixaId: string | null;
}

export interface PrecoPreviewParams {
  imobiliariaId: string;
  tipoServicoId: string;
  metragem: number;
  mobiliado: boolean;
  valorAluguel?: number | null;
}

export function usePrecoPreview(params: PrecoPreviewParams | null) {
  return useQuery({
    queryKey: ['preco-preview', params],
    queryFn: () =>
      apiClient.request<PrecoPreview>(
        `/v1/solicitacoes/preco-preview${query({
          imobiliariaId: params!.imobiliariaId,
          tipoServicoId: params!.tipoServicoId,
          metragem: params!.metragem,
          mobiliado: params!.mobiliado,
          valorAluguel: params!.valorAluguel ?? undefined,
        })}`,
      ),
    enabled: !!params && !!params.tipoServicoId && params.metragem > 0,
    retry: false,
    staleTime: 1000 * 30,
  });
}

/** Corpo do 409 no checkout quando falta vistoriador elegível para a janela. */
export interface SemVistoriadorBody {
  codigo: 'SEM_VISTORIADOR';
  servicos: string[];
}

export function isSemVistoriador(err: unknown): err is ApiError & { body: SemVistoriadorBody } {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    !!err.body &&
    typeof err.body === 'object' &&
    (err.body as { codigo?: string }).codigo === 'SEM_VISTORIADOR'
  );
}

/** Status derivado de uma solicitação. */
export function useSolicitacaoStatus(solicitacaoId?: string) {
  return useQuery({
    queryKey: ['solicitacao', solicitacaoId, 'status'],
    queryFn: async () => {
      const r = await apiClient.request<{ status: string }>(`/v1/solicitacoes/${solicitacaoId}/status`);
      return r.status;
    },
    enabled: !!solicitacaoId,
  });
}

/** Cancela um serviço da solicitação. */
export function useCancelarServico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (servicoId: string) =>
      apiClient.request(`/v1/solicitacoes/servicos/${servicoId}/cancelar`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
    },
  });
}

/** Serviço de uma solicitação (GET /v1/solicitacoes/{id}/servicos). */
export interface SolicitacaoServicoItem {
  id: string;
  tipoServicoId: string;
  status: string;
  vistoriadorId: string | null;
  dataAgendada: string | null;
  precoSnapshot: string;
}

export function useSolicitacaoServicos(solicitacaoId?: string) {
  return useQuery({
    queryKey: ['solicitacao-servicos', solicitacaoId],
    queryFn: () =>
      apiClient.request<SolicitacaoServicoItem[]>(`/v1/solicitacoes/${solicitacaoId}/servicos`),
    enabled: !!solicitacaoId,
  });
}

/** Reatribui um serviço a outro vistoriador (POST /v1/servicos/{id}/reatribuir). Assíncrono. */
export function useReatribuir() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoId, motivo, vistoriadorAtual }: { servicoId: string; motivo: string; vistoriadorAtual?: string | null }) =>
      apiClient.request(`/v1/servicos/${servicoId}/reatribuir`, {
        method: 'POST',
        body: JSON.stringify({ motivo, vistoriadorAtual: vistoriadorAtual ?? null }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacao-servicos'] });
    },
  });
}

/** Imóveis disponíveis para seleção no wizard (passo 1). */
export function useImoveis(filters?: { page?: number; size?: number; imobiliariaId?: string; enabled?: boolean }) {
  const page = filters?.page ?? 0;
  const size = filters?.size ?? 100;
  const imobiliariaId = filters?.imobiliariaId;

  return useQuery({
    queryKey: ['imoveis', page, size, imobiliariaId],
    queryFn: () =>
      apiClient.request<PagedResponse<Imovel>>(`/v1/imoveis${query({ page, size, imobiliariaId })}`),
    staleTime: 1000 * 60 * 5,
    // Vistoriador não pode listar imóveis (403); quem não vai criar solicitação não dispara a query.
    enabled: filters?.enabled ?? true,
  });
}

/** Clientes (passo 1 do wizard). */
export function useClientes(filters?: { page?: number; size?: number }) {
  const page = filters?.page ?? 0;
  const size = filters?.size ?? 100;

  return useQuery({
    queryKey: ['clientes', page, size],
    queryFn: () => apiClient.request<PagedResponse<Cliente>>(`/v1/clientes${query({ page, size })}`),
    staleTime: 1000 * 60 * 5,
  });
}

/** Papéis de interveniente ativos (passo Intervenientes do wizard). */
export function useIntervenientePapeis() {
  return useQuery({
    queryKey: ['interveniente-papeis'],
    queryFn: () => apiClient.request<IntervenientePapel[]>('/v1/interveniente-papeis'),
    staleTime: 1000 * 60 * 10,
  });
}

/** Tipos de serviço ativos (passo 3 do wizard). */
export function useTiposServico() {
  return useQuery({
    queryKey: ['tipos-servico'],
    queryFn: () => apiClient.request<PagedResponse<TipoServico>>('/v1/tipos-servico?size=100'),
    staleTime: 1000 * 60 * 10,
  });
}

// useCidades() moved to api/imoveis.ts — kept as the single canonical hook (flat Cidade[],
// key ['cidades']) so it can't collide with a differently-shaped hook under the same
// React Query cache key.

export { EMPTY_PAGE };
