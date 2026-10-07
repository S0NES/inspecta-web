import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { ExtratoItemStatus } from './extrato';

/** Consumo por imobiliária no mês (GET /v1/relatorios/consumo). */
export interface ConsumoImobiliaria {
  imobiliariaId: string;
  imobiliariaNome: string;
  servicosPagos: number;
  valorTotal: number;
  /** Cobranças ainda em aberto (criando/pendente) no período. */
  pagamentosPendentes: number;
  valorPendente: number;
  /** Teto de serviços/mês do contrato ativo; `null` quando o contrato não tem teto. */
  volumeMensal: number | null;
  /** `true` quando `servicosPagos` passou de `volumeMensal` no período. */
  volumeExcedido: boolean;
}

/** Uma linha de GET /v1/relatorios/vistorias. */
export interface VistoriaExtratoLinha {
  id: string;
  solicitacaoId: string;
  imobiliariaId: string | null;
  imobiliariaNome: string | null;
  endereco: string;
  tipoServico: string | null;
  vistoriador: string | null;
  status: ExtratoItemStatus;
  criadoEm: string;
  valor: number;
  laudoId: string | null;
}

export interface VistoriasPage {
  content: VistoriaExtratoLinha[];
  totalElements: number;
  totalPages: number;
  number: number;
  totalFaturado: number;
}

export function useExtratoVistorias(params: {
  mes: string;
  imobiliariaId?: string | null;
  nome?: string;
  page?: number;
  size?: number;
  enabled?: boolean;
}) {
  const mes = params.mes;
  const nome = params.nome?.trim() ?? '';
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  return useQuery({
    queryKey: ['relatorio-vistorias', mes, params.imobiliariaId ?? '', nome, page, size],
    queryFn: () => {
      const qs = new URLSearchParams({ mes, page: String(page), size: String(size) });
      if (params.imobiliariaId) qs.set('imobiliariaId', params.imobiliariaId);
      if (nome) qs.set('nome', nome);
      return apiClient.request<VistoriasPage>(`/v1/relatorios/vistorias?${qs.toString()}`);
    },
    enabled: (params.enabled ?? true) && /^\d{4}-\d{2}$/.test(mes),
    staleTime: 1000 * 30,
  });
}

/** `mes` no formato `yyyy-MM`. */
export function useConsumoCrossImobiliaria(mes: string) {
  return useQuery({
    queryKey: ['relatorio-consumo', mes],
    queryFn: () => apiClient.request<ConsumoImobiliaria[]>(`/v1/relatorios/consumo?mes=${mes}`),
    enabled: /^\d{4}-\d{2}$/.test(mes),
  });
}
