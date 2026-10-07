import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Métricas de envio — read models servidos por `GET /v1/metricas/*`.
 *
 * Espelham os records de `MetricasQueryService` (inspecta-core). O inspecta-api lê só as
 * tabelas de rollup diário (D-1), então a tela nunca agrega dados crus: cada
 * bucket já vem somado por dia × dimensão.
 */

/** Um bucket diário de envios (dimensões: tipo de envio × tipo de comunicação). */
export interface EnvioBucket {
  /** `null` apenas no bucket sintético de `totais`. */
  dia: string | null;
  tipoEnvio: string | null;
  tipoComunicacao: string | null;
  criados: number;
  enviados: number;
  entregues: number;
  aberturas: number;
  cliques: number;
  bounces: number;
  reclamacoes: number;
  falhas: number;
}

export interface EnviosResponse {
  inicio: string;
  fim: string;
  buckets: EnvioBucket[];
  /** Soma de todos os buckets no período; dimensões vêm `null`. */
  totais: EnvioBucket;
}

/** Um bucket diário de solicitações (dimensão: tipo de serviço). */
export interface SolicitacaoBucket {
  dia: string | null;
  tipoServicoId: string | null;
  tipoServicoNome: string;
  concluidas: number;
  emAndamento: number;
}

export interface SolicitacoesResponse {
  inicio: string;
  fim: string;
  buckets: SolicitacaoBucket[];
}

export interface MetricasJanela {
  /** yyyy-MM-dd; default: 30 dias atrás de {@link fim}. */
  inicio?: string;
  /** yyyy-MM-dd; default: ontem (D-1). */
  fim?: string;
  /** As consultas de métricas só rodam com o modal aberto. */
  enabled?: boolean;
}

/** yyyy-MM-dd em UTC. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Janela padrão: últimos 30 dias terminando **ontem** (D-1) — o rollup no
 * inspecta-worker só fecha o dia anterior, então nunca pedimos o dia corrente.
 */
export function janelaPadrao(hoje: Date = new Date()): { inicio: string; fim: string } {
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  fim.setUTCDate(fim.getUTCDate() - 1);
  const inicio = new Date(fim);
  inicio.setUTCDate(inicio.getUTCDate() - 29);
  return { inicio: isoDate(inicio), fim: isoDate(fim) };
}

function query(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.append(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Métricas mudam no máximo 1×/dia (rollup D-1) — 5 min de staleTime é folgado. */
const STALE_METRICAS = 1000 * 60 * 5;

function resolverJanela(opts?: MetricasJanela) {
  const padrao = janelaPadrao();
  return {
    inicio: opts?.inicio ?? padrao.inicio,
    fim: opts?.fim ?? padrao.fim,
    enabled: opts?.enabled ?? true,
  };
}

/** `GET /v1/metricas/envios` — série por tipo de envio, quantidade × dia. */
export function useMetricasEnvios(opts?: MetricasJanela) {
  const { inicio, fim, enabled } = resolverJanela(opts);

  return useQuery({
    queryKey: ['metricas-envios', { inicio, fim }],
    queryFn: () =>
      apiClient.request<EnviosResponse>(`/v1/metricas/envios${query({ inicio, fim })}`),
    staleTime: STALE_METRICAS,
    enabled,
  });
}

/** `GET /v1/metricas/solicitacoes` — série por tipo de serviço, concluídas / em andamento. */
export function useMetricasSolicitacoes(opts?: MetricasJanela) {
  const { inicio, fim, enabled } = resolverJanela(opts);

  return useQuery({
    queryKey: ['metricas-solicitacoes', { inicio, fim }],
    queryFn: () =>
      apiClient.request<SolicitacoesResponse>(`/v1/metricas/solicitacoes${query({ inicio, fim })}`),
    staleTime: STALE_METRICAS,
    enabled,
  });
}
