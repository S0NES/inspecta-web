import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Extrato por vistoria (granular) + faturamento consolidado por imobiliária.
 *
 * Backend (inspecta-api, ver plano-b2b-billing.md Parte B2):
 *   GET  /v1/imobiliarias/{id}/extrato/itens?inicio=&fim=   -> ExtratoItemView[] (em aberto no período)
 *   POST /v1/imobiliarias/{id}/extrato/faturas  { inicio, fim }  -> 202 { faturaId, valorTotal, checkoutUrl? }
 *   GET  /v1/imobiliarias/{id}/extrato/faturas              -> FaturaConsolidada[] (histórico)
 *
 * `inicio`/`fim` são datas puras (YYYY-MM-DD), sem hora.
 */

/** Enum real de `solicitacao_servicos.status` (6 estados). */
export type ExtratoItemStatus =
  | 'pendente'
  | 'atribuida'
  | 'agendada'
  | 'em_execucao'
  | 'concluida'
  | 'cancelada';

/**
 * Uma linha do extrato = um `extrato_item` (vinculado a um `solicitacao_servico`),
 * já com os joins resolvidos pelo backend (endereço, tipo de serviço, vistoriador,
 * laudo). Não existe entidade "vistoria" — a unidade é o serviço da solicitação.
 */
export interface ExtratoItemView {
  id: string;
  imobiliariaId: string;
  imobiliariaNome: string;
  /** Identificação da vistoria: endereço do imóvel. */
  endereco: string;
  /** Tipo de serviço, quando ajuda a diferenciar linhas do mesmo imóvel. */
  tipoServico: string | null;
  /** Nome do vistoriador, ou `null` quando ainda não atribuído. */
  vistoriador: string | null;
  status: ExtratoItemStatus;
  /** Data de criação do item/serviço (ISO). */
  criadoEm: string;
  /** Valor da vistoria — `preco_snapshot` congelado na criação. */
  valor: number;
  solicitacaoId: string;
  solicitacaoServicoId: string;
  /** `null` quando ainda não há laudo para esse serviço. */
  laudoId: string | null;
}

export type FaturaConsolidadaStatus = 'pendente' | 'checkout_ready' | 'pago' | 'erro';

export interface FaturaConsolidada {
  id: string;
  periodoInicio: string;
  periodoFim: string;
  valorTotal: number;
  status: FaturaConsolidadaStatus;
  checkoutUrl: string | null;
  criadoEm: string;
}

/** Resposta de `POST .../extrato/faturas`. */
export interface GerarFaturaResult {
  faturaId: string;
  valorTotal: number;
  checkoutUrl?: string | null;
}

const isDate = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Itens de extrato em aberto (sem fatura) da imobiliária no período.
 * `imobiliariaId` nulo (admin sem recorte) desabilita a consulta.
 */
export function useExtratoItens(
  imobiliariaId: string | null,
  inicio: string,
  fim: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['extrato-itens', imobiliariaId, inicio, fim],
    queryFn: () =>
      apiClient.request<ExtratoItemView[]>(
        `/v1/imobiliarias/${imobiliariaId}/extrato/itens?inicio=${inicio}&fim=${fim}`,
      ),
    enabled: (options?.enabled ?? true) && !!imobiliariaId && isDate(inicio) && isDate(fim),
    staleTime: 1000 * 30,
  });
}

/** Histórico de faturas consolidadas da imobiliária. */
export function useFaturas(imobiliariaId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['extrato-faturas', imobiliariaId],
    queryFn: () =>
      apiClient.request<FaturaConsolidada[]>(`/v1/imobiliarias/${imobiliariaId}/extrato/faturas`),
    enabled: (options?.enabled ?? true) && !!imobiliariaId,
    // Curto: o pagamento da fatura acontece em outra aba (link do provedor) e a lista precisa refletir o "pago" ao voltar.
    staleTime: 1000 * 5,
  });
}

/**
 * Gera a cobrança consolidada dos itens em aberto do período. O checkout pode
 * voltar já pronto (`checkoutUrl`) ou ser gerado de forma assíncrona pelo
 * inspecta-worker (`202`, sem URL — a lista de faturas mostra quando ficar pronto).
 */
export function useGerarFaturaConsolidada(imobiliariaId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      inicio,
      fim,
      idempotencyKey,
    }: {
      inicio: string;
      fim: string;
      idempotencyKey?: string;
    }) =>
      apiClient.request<GerarFaturaResult>(
        `/v1/imobiliarias/${imobiliariaId}/extrato/faturas`,
        {
          method: 'POST',
          body: JSON.stringify({ inicio, fim }),
          headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extrato-itens', imobiliariaId] });
      qc.invalidateQueries({ queryKey: ['extrato-faturas', imobiliariaId] });
    },
  });
}
