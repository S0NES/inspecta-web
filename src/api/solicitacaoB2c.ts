import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from './client';

/**
 * API do wizard de solicitação do Cliente B2C (Fase 1 — tela 4, role CLIENTE):
 *  - POST  /v1/solicitacoes/rascunho-b2c            — cria o rascunho (imóvel + serviço + data).
 *  - PATCH /v1/solicitacoes/{id}/rascunho-b2c        — retry (já existe solicitacaoId): só
 *    troca `b2cServiceId`/`dataDesejada` — o imóvel já foi criado, não muda mais aqui.
 *  - PATCH /v1/solicitacoes/{id}/intervenientes      — substitui a lista de intervenientes
 *    (o acompanhante da etapa de serviço fica intocado pelo backend).
 *  - POST  /v1/solicitacoes/{id}/finalizar           — confirma a solicitação (ação do "Salvar").
 * As duas primeiras (e o finalizar) podem devolver 409 `SEM_VISTORIADOR` — ver
 * `isSemVistoriador` em `api/solicitacoes.ts` (reusado aqui, não duplicado).
 */

export interface RascunhoB2cImovel {
  cidadeId: string;
  cep?: string | null;
  endereco: string;
  numero?: string | null;
  complemento?: string | null;
  metragem: number;
  tipo?: string;
  quartos?: number | null;
  cobertura?: boolean;
  valorAluguel?: number | null;
  mobiliado?: boolean;
}

export interface RascunhoB2cAcompanhante {
  papelSlug?: string;
  nome: string;
  cpf: string;
  email: string;
  telefone?: string | null;
}

export interface CreateRascunhoB2cRequest {
  imovel: RascunhoB2cImovel;
  b2cServiceId: string;
  /** ISO instant. */
  dataDesejada: string;
  acompanhante?: RascunhoB2cAcompanhante;
}

export interface PatchRascunhoB2cRequest {
  b2cServiceId: string;
  /** ISO instant. */
  dataDesejada: string;
}

export interface RascunhoB2cResponse {
  solicitacaoId: string;
  servicoId: string;
  status: string;
  precoSnapshot: number;
  dataAgendada: string;
  vistoriadorId: string | null;
  vistoriadorNome: string | null;
}

/** POST /v1/solicitacoes/rascunho-b2c — primeira tentativa (ainda sem `solicitacaoId`). */
export function useCreateRascunhoB2c() {
  return useMutation({
    mutationFn: (body: CreateRascunhoB2cRequest) =>
      apiClient.request<RascunhoB2cResponse>('/v1/solicitacoes/rascunho-b2c', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

/** PATCH /v1/solicitacoes/{id}/rascunho-b2c — retry (409 anterior, ou voltou e mudou data/serviço). */
export function usePatchRascunhoB2c() {
  return useMutation({
    mutationFn: ({ id, ...body }: PatchRascunhoB2cRequest & { id: string }) =>
      apiClient.request<RascunhoB2cResponse>(`/v1/solicitacoes/${id}/rascunho-b2c`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  });
}

export interface IntervenienteB2cItem {
  papelSlug: string;
  nome: string;
  cpf: string;
  email: string;
  telefone?: string | null;
}

/** PATCH /v1/solicitacoes/{id}/intervenientes — substitui a lista (exceto o acompanhante). 200 vazio. */
export function usePatchIntervenientesB2c() {
  return useMutation({
    mutationFn: ({ id, intervenientes }: { id: string; intervenientes: IntervenienteB2cItem[] }) =>
      apiClient.request<void>(`/v1/solicitacoes/${id}/intervenientes`, {
        method: 'PATCH',
        body: JSON.stringify({ intervenientes }),
      }),
  });
}

/** POST /v1/solicitacoes/{id}/finalizar — a ação do "Salvar" na Confirmação. */
export function useFinalizarSolicitacaoB2c() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.request<RascunhoB2cResponse>(`/v1/solicitacoes/${id}/finalizar`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
    },
  });
}

/**
 * 400 só do `finalizar`: zero intervenientes no total (sem acompanhante da etapa de
 * serviço E lista da etapa de intervenientes vazia). ProblemDetail simples, sem `codigo`
 * (ao contrário do 409 SEM_VISTORIADOR) — por isso o detector olha `detail` direto.
 */
export function isAoMenosUmIntervenienteObrigatorio(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 400 &&
    !!err.body &&
    typeof err.body === 'object' &&
    (err.body as { detail?: string }).detail === 'ao_menos_um_interveniente_obrigatorio'
  );
}
