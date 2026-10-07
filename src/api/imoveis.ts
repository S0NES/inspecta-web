import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * API types for the Cadastro module
 * Matches backend entities and DTOs
 */

export interface Cidade {
  id: string;
  nome: string;
  uf: string;
}

/**
 * Imóvel — GET /v1/imoveis (ImovelResponse, inspecta-api). O backend devolve `cidadeId` (número),
 * não o nome da cidade; a lista resolve o rótulo pela lista de `useCidades()`. Os campos
 * `cidade/situacao/dormitorios/banheiros/area/vistoriador` NÃO vêm da API (herança de mock)
 * e ficam opcionais — não confie neles em tela nova.
 */
export interface Imovel {
  id: string;
  endereco: string;
  tipo: string;
  cidadeId: string;
  cep?: string | null;
  /** Imobiliária dona do imóvel (mesmo campo aceito no POST/PATCH). */
  imobiliariaId?: string | null;
  metragem?: number;
  mobiliado?: boolean;
  ativo?: boolean;
  /** Número (ViaCEP nunca devolve — sempre digitado à mão). */
  numero?: string | null;
  /** Complemento (apto, bloco, fundos…). */
  complemento?: string | null;
  /** V3: valor do aluguel — base do cálculo de biletagem percentual. */
  valorAluguel?: number | null;
  /** Quantidade de quartos; nulo quando o chip Quarto não está ativo. */
  quartos?: number | null;
  /** Se o imóvel possui cobertura. */
  cobertura?: boolean;
  /** @deprecated não é retornado pela API — use `cidadeId` + `useCidades()`. */
  cidade?: string;
  /** @deprecated não é retornado pela API. */
  situacao?: string;
  /** @deprecated não é retornado pela API. */
  dormitorios?: number;
  /** @deprecated não é retornado pela API. */
  banheiros?: number;
  /** @deprecated não é retornado pela API. */
  area?: string;
  /** @deprecated não é retornado pela API. */
  vistoriador?: string;
}

/** Body accepted by POST /v1/imoveis — matches the real Imovel entity. */
export interface CreateImovelRequest {
  cidadeId: string;
  endereco: string;
  cep?: string | null;
  /** Número do imóvel (o backend já tem a coluna `Imovel.numero`). */
  numero?: string | null;
  /** Complemento do imóvel (o backend já tem a coluna `Imovel.complemento`). */
  complemento?: string | null;
  metragem: number;
  mobiliado: boolean;
  tipo?: string;
  /** V3: valor do aluguel (obrigatório só quando a biletagem é percentual). */
  valorAluguel?: number | null;
  /** Quantidade de quartos; omitir/null quando o imóvel não declara quarto. */
  quartos?: number | null;
  /** Se o imóvel possui cobertura. */
  cobertura?: boolean;
  /**
   * V25/B4: imobiliária dona do imóvel. Opcional — o backend herda do tenant
   * quando o usuário atende exatamente uma. Obrigatório para admin ou usuário
   * com mais de um vínculo.
   */
  imobiliariaId?: string | null;
  /** cadastro externo — imo_codigo de um imóvel que já existe na Pleno. */
  plenoIdExterno?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface ImovelFilters {
  tipo?: string;
  cidade?: string;
  situacao?: string;
  page?: number;
  size?: number;
}

/**
 * Fetch cities for dropdowns
 */
export function useCidades() {
  return useQuery({
    queryKey: ['cidades'],
    queryFn: async () => {
      const response = await apiClient.request<PageResponse<Cidade>>(
        '/v1/cidades?page=0&size=100'
      );
      return response.content;
    },
  });
}

/** Um logradouro retornado pela busca de endereço do ViaCEP. */
export interface ViaCepEndereco {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

/**
 * Busca de logradouros no ViaCEP restrita a uma cidade/UF.
 *
 * https://viacep.com.br/ws/{UF}/{cidade}/{logradouro}/json/ — o ViaCEP exige no
 * mínimo 3 caracteres em `cidade` e em `logradouro`. Retorna uma lista (até 50)
 * ou `[]`. Qualquer falha de rede/serviço vira lista vazia — a busca é auxiliar,
 * o usuário ainda pode digitar a rua à mão.
 */
export async function buscarLogradourosViaCep(
  uf: string,
  cidade: string,
  termo: string,
  signal?: AbortSignal,
): Promise<ViaCepEndereco[]> {
  const rua = termo.trim();
  if (uf.trim().length !== 2 || cidade.trim().length < 3 || rua.length < 3) return [];

  const url = `https://viacep.com.br/ws/${encodeURIComponent(uf.trim())}/${encodeURIComponent(
    cidade.trim(),
  )}/${encodeURIComponent(rua)}/json/`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as ViaCepEndereco[]) : [];
  } catch {
    return [];
  }
}

/**
 * Hook: busca de logradouros no ViaCEP dentro da cidade selecionada.
 * Só dispara com cidade definida e termo com 3+ caracteres.
 */
export function useLogradourosViaCep(
  uf: string | undefined,
  cidade: string | undefined,
  termo: string,
) {
  const rua = termo.trim();
  return useQuery({
    queryKey: ['viacep-logradouros', uf, cidade, rua.toLowerCase()],
    queryFn: ({ signal }) => buscarLogradourosViaCep(uf!, cidade!, rua, signal),
    enabled: !!uf && !!cidade && rua.length >= 3,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

/** Endereço retornado pela consulta direta de CEP do ViaCEP (objeto único). */
export interface ViaCepCep {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

/** Só os dígitos de um CEP (remove hífen, espaços, etc.). */
const somenteDigitos = (s: string) => (s ?? '').replace(/\D/g, '');

/**
 * Consulta direta de CEP no ViaCEP: `https://viacep.com.br/ws/{cep}/json/`.
 *
 * Devolve um único objeto `{ cep, logradouro, complemento, bairro, localidade, uf }`
 * ou `null` quando o CEP não existe (`{ erro: true }`), não tem 8 dígitos, ou a
 * rede/serviço falha — nunca lança. O autofill é auxiliar; o usuário ainda pode
 * digitar tudo à mão.
 */
export async function buscarEnderecoPorCep(
  cep: string,
  signal?: AbortSignal,
): Promise<ViaCepCep | null> {
  const digitos = somenteDigitos(cep);
  if (digitos.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object' || (data as { erro?: unknown }).erro) return null;
    return data as ViaCepCep;
  } catch {
    return null;
  }
}

/**
 * Hook: consulta direta de CEP no ViaCEP. Só dispara quando o CEP tem exatamente
 * 8 dígitos (após remover não-dígitos).
 */
export function useEnderecoPorCep(cep: string | undefined) {
  const digitos = somenteDigitos(cep ?? '');
  return useQuery({
    queryKey: ['viacep-cep', digitos],
    queryFn: ({ signal }) => buscarEnderecoPorCep(digitos, signal),
    enabled: digitos.length === 8,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

/**
 * Fetch list of properties with optional filters
 */
export function useImoveis(filters?: ImovelFilters) {
  const params = new URLSearchParams();
  params.append('page', String(filters?.page ?? 0));
  params.append('size', String(filters?.size ?? 50));

  if (filters?.tipo && filters.tipo !== '') {
    params.append('tipo', filters.tipo);
  }
  if (filters?.cidade && filters.cidade !== '') {
    params.append('cidade', filters.cidade);
  }
  if (filters?.situacao && filters.situacao !== '') {
    params.append('situacao', filters.situacao);
  }

  return useQuery({
    queryKey: ['imoveis', filters],
    queryFn: async () => {
      const response = await apiClient.request<PageResponse<Imovel>>(
        `/v1/imoveis?${params.toString()}`
      );
      return response;
    },
  });
}

/**
 * Fetch a single property by ID
 */
export function useImovel(id: string | null) {
  return useQuery({
    queryKey: ['imovel', id],
    queryFn: async () => {
      if (!id) return null;
      return apiClient.request<Imovel>(`/v1/imoveis/${id}`);
    },
    enabled: !!id,
  });
}

/**
 * Create a new property
 */
export function useCreateImovel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idempotencyKey, ...data }: CreateImovelRequest & { idempotencyKey?: string }) => {
      return apiClient.request<Imovel>('/v1/imoveis', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      });
    },
    onSuccess: () => {
      // Invalidate the imoveis list so it refetches
      queryClient.invalidateQueries({ queryKey: ['imoveis'] });
    },
  });
}

/** P1: atualização parcial de imóvel — inclui situação ativo/inativo. */
export function usePatchImovel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<CreateImovelRequest> & { ativo?: boolean }) =>
      apiClient.request<Imovel>(`/v1/imoveis/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imoveis'] });
      queryClient.invalidateQueries({ queryKey: ['imovel'] });
    },
  });
}

/**
 * Fetch all cities (for creating properties)
 */
export function useAllCidades() {
  return useQuery({
    queryKey: ['cidades-all'],
    queryFn: async () => {
      const response = await apiClient.request<PageResponse<Cidade>>(
        '/v1/cidades?page=0&size=100'
      );
      return response.content;
    },
  });
}
