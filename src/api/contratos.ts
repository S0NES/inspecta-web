import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Contrato (biletagem) de uma imobiliária — editado DENTRO do cadastro da imobiliária
 * (Agency, modo edição — via `BiletagemSection`), não mais numa tela própria.
 *
 * Contrato (Agente B):
 *   GET  /v1/imobiliarias/{id}                     -> inclui `contrato` (ContratoResumo)
 *   GET/PUT  /v1/imobiliarias/{id}/contrato        PUT { modo, percentual?, percentualMinimo? }
 *   GET/PUT/DELETE /v1/imobiliarias/{id}/contrato/grupos   item { servicoId, percentual?, percentualMinimo? }
 *   GET/PUT  /v1/imobiliarias/{id}/contrato/faixas         valores com/sem mobília por faixa
 *
 * Uma imobiliária tem UM tipo de biletagem (faixa OU percentual), para a agência toda.
 * Os VALORES são por Produto selecionado.
 */

export type ContratoModo = 'faixa' | 'percentual';

/**
 * 5 faixas fixas/globais (`faixa_referencia`, seed na migration V3). Estrutura só-leitura.
 * O backend (B2) devolve esse catálogo junto com os valores — em
 * `GET /v1/imobiliarias/{id}/contrato` (campo `faixaReferencia`) e em
 * `GET /v1/imobiliarias/{id}/contrato/faixas`. `metragemMax` é `null` na faixa 5.
 */
export interface FaixaReferencia {
  id: string;
  ordem: number;
  metragemMin: number;
  metragemMax: number | null;
  rotulo: string;
}

/** Fallback local — só usado quando o backend não devolve `faixaReferencia`. */
export const FAIXAS_REFERENCIA: FaixaReferencia[] = [
  { id: '1', ordem: 1, metragemMin: 0, metragemMax: 40, rotulo: '0 – 40 m²' },
  { id: '2', ordem: 2, metragemMin: 41, metragemMax: 70, rotulo: '41 – 70 m²' },
  { id: '3', ordem: 3, metragemMin: 71, metragemMax: 120, rotulo: '71 – 120 m²' },
  { id: '4', ordem: 4, metragemMin: 121, metragemMax: 195, rotulo: '121 – 195 m²' },
  { id: '5', ordem: 5, metragemMin: 195.01, metragemMax: null, rotulo: 'acima de 195 m² (+75 m²)' },
];

/** Um Produto coberto pelo contrato (+ valores do modo percentual). */
export interface ContratoGrupo {
  servicoId: string;
  /** modo percentual: % do aluguel para este serviço. */
  percentual?: number | null;
  /** modo percentual: piso; valor = max(% * aluguel, mínimo). */
  percentualMinimo?: number | null;
}

/**
 * Valor de uma faixa (modo faixa) para um Produto.
 * Chave = `(servicoId, faixaId)`, onde `faixaId` === `faixa_referencia.id` (1..5).
 * Shape idêntico ao body do `PUT /v1/imobiliarias/{id}/contrato/faixas` (replace-all).
 */
export interface ContratoFaixaValor {
  servicoId: string;
  /** id de faixa_referencia (1..5). */
  faixaId: string;
  valorSemMobilia: number | null;
  valorComMobilia: number | null;
  /** só faixa 5 (`faixaId === 5`): passo de metragem (default 75) e incremento Z. */
  paStepMetragem?: number | null;
  paStepValor?: number | null;
}

/**
 * Resposta de `GET /v1/imobiliarias/{id}/contrato/faixas`: os valores + o catálogo
 * global de faixas de referência (para rótulos/intervalos na UI).
 */
export interface ContratoFaixasResponse {
  faixas: ContratoFaixaValor[];
  faixaReferencia: FaixaReferencia[];
}

export interface ContratoResumo {
  modo: ContratoModo;
  percentual: number | null;
  percentualMinimo: number | null;
  grupos: ContratoGrupo[];
  faixas: ContratoFaixaValor[];
  /** Catálogo global de faixas — vem aninhado no `GET /v1/imobiliarias/{id}/contrato`. */
  faixaReferencia: FaixaReferencia[];
}

export interface PutContratoRequest {
  modo: ContratoModo;
  percentual?: number | null;
  percentualMinimo?: number | null;
}

export function useImobiliariaContrato(imobiliariaId: string | null) {
  return useQuery({
    queryKey: ['imobiliaria-contrato', imobiliariaId],
    queryFn: () => apiClient.request<ContratoResumo>(`/v1/imobiliarias/${imobiliariaId}/contrato`),
    enabled: !!imobiliariaId,
    retry: 1,
  });
}

export function usePutContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imobiliariaId, ...body }: { imobiliariaId: string } & PutContratoRequest) =>
      apiClient.request<ContratoResumo>(`/v1/imobiliarias/${imobiliariaId}/contrato`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['imobiliaria-contrato', v.imobiliariaId] });
      qc.invalidateQueries({ queryKey: ['imobiliarias'] });
    },
  });
}

export function useContratoGrupos(imobiliariaId: string | null) {
  return useQuery({
    queryKey: ['contrato-grupos', imobiliariaId],
    queryFn: () => apiClient.request<ContratoGrupo[]>(`/v1/imobiliarias/${imobiliariaId}/contrato/grupos`),
    enabled: !!imobiliariaId,
    retry: 1,
  });
}

export function usePutContratoGrupos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imobiliariaId, grupos }: { imobiliariaId: string; grupos: ContratoGrupo[] }) =>
      apiClient.request<ContratoGrupo[]>(`/v1/imobiliarias/${imobiliariaId}/contrato/grupos`, {
        method: 'PUT',
        body: JSON.stringify(grupos),
      }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['contrato-grupos', v.imobiliariaId] }),
  });
}

export function useContratoFaixas(imobiliariaId: string | null) {
  return useQuery({
    queryKey: ['contrato-faixas', imobiliariaId],
    queryFn: () =>
      apiClient.request<ContratoFaixasResponse>(`/v1/imobiliarias/${imobiliariaId}/contrato/faixas`),
    enabled: !!imobiliariaId,
    retry: 1,
  });
}

export function usePutContratoFaixas() {
  const qc = useQueryClient();
  return useMutation({
    // Body = array plano de `(servicoId, faixaId)` — replace-all.
    mutationFn: ({ imobiliariaId, faixas }: { imobiliariaId: string; faixas: ContratoFaixaValor[] }) =>
      apiClient.request<ContratoFaixasResponse>(`/v1/imobiliarias/${imobiliariaId}/contrato/faixas`, {
        method: 'PUT',
        body: JSON.stringify(faixas),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['contrato-faixas', v.imobiliariaId] });
      qc.invalidateQueries({ queryKey: ['imobiliaria-contrato', v.imobiliariaId] });
    },
  });
}
