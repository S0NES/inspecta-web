import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Status de pagamento a nível de solicitação (coluna `solicitacoes.payment_status`).
 * Distinto do status da `Pagamento`/`Cobranca` abaixo: aqui o foco é "o checkout já
 * pode ser aberto?".
 */
export type PaymentStatus = 'nao_iniciado' | 'checkout_ready' | 'pago' | 'erro';

/**
 * Metadados de pagamento que acompanham a solicitação nas respostas de
 * `POST /v1/solicitacoes` e `GET /v1/solicitacoes/{id}`.
 *
 * O backend ainda pode ajustar o formato exato: aceitamos tanto um objeto
 * `payment` encapsulado quanto os campos soltos no topo do `Solicitacao`
 * serializado (`paymentStatus` / `checkoutReady` / `checkoutId` / `checkoutUrl`).
 * `parsePaymentMeta` normaliza os dois. Ver payment-flow-spec.md § "API contract".
 */
export interface PaymentMeta {
  status: PaymentStatus | null;
  checkoutReady: boolean;
  checkoutId: string | null;
  checkoutUrl: string | null;
  /** `true` quando a solicitação exige pagamento antes da atribuição. */
  required: boolean;
  /** Motivo textual quando `status === 'erro'` (provedor fora do ar etc.). */
  reason: string | null;
}

type RawPayment = {
  payment?: Record<string, unknown> | null;
  paymentStatus?: unknown;
  status?: unknown;
  checkoutReady?: unknown;
  checkoutId?: unknown;
  checkoutUrl?: unknown;
  required?: unknown;
  reason?: unknown;
  solicitacao?: Record<string, unknown> | null;
} | null | undefined;

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

/**
 * Lê os metadados de pagamento de uma resposta seja qual for o formato:
 *  - `{ solicitacao, payment: { status, checkoutReady, checkoutId, checkoutUrl, ... } }`
 *  - `{ ...Solicitacao, paymentStatus, checkoutReady, checkoutId, checkoutUrl }`
 *  - qualquer subconjunto disso (campos ausentes viram null/false).
 */
export function parsePaymentMeta(raw: RawPayment): PaymentMeta {
  const top = (raw ?? {}) as Record<string, unknown>;
  const wrapper = (top.payment ?? null) as Record<string, unknown> | null;
  const inner = (top.solicitacao ?? null) as Record<string, unknown> | null;

  // Precedência: objeto `payment` > campos top-level > campos dentro de `solicitacao`.
  const pick = (key: string): unknown =>
    wrapper?.[key] ?? top[key] ?? inner?.[key];

  const status = (str(wrapper?.status) ??
    str(top.paymentStatus) ??
    str(inner?.paymentStatus)) as PaymentStatus | null;

  const checkoutUrl = str(pick('checkoutUrl'));
  const checkoutReadyRaw = pick('checkoutReady');

  return {
    status,
    checkoutReady:
      checkoutReadyRaw === true ||
      status === 'checkout_ready' ||
      status === 'pago' ||
      (checkoutReadyRaw == null && !!checkoutUrl),
    checkoutId: str(pick('checkoutId')),
    checkoutUrl,
    required: pick('required') === true || (pick('required') == null && !!status && status !== 'nao_iniciado'),
    reason: str(pick('reason')),
  };
}

/**
 * `true` quando faz sentido oferecer o CTA "Pagar": existe um checkout e a
 * solicitação ainda não foi paga. Ver payment-flow-spec.md § "API contract".
 */
export function podeExibirPagar(p: {
  checkoutUrl?: string | null;
  paymentStatus?: string | null;
}): boolean {
  return !!p.checkoutUrl && p.paymentStatus !== 'pago';
}

/** Cobrança de uma solicitação (GET/POST /v1/solicitacoes/{id}/pagamento). */
export interface Cobranca {
  pagamentoId: string | null;
  status: 'criando' | 'pendente' | 'pago' | 'falhou' | 'estornado' | null;
  checkoutUrl: string | null;
  /** Campos novos do fluxo de checkout — o backend pode ainda não mandar todos. */
  checkoutId?: string | null;
  checkoutReady?: boolean;
  paymentStatus?: PaymentStatus | null;
  /** PIX transparente: copia-e-cola, QR (data URI PNG) e expiração (ISO). Nulos até o provedor responder. */
  pixBrCode?: string | null;
  pixQrCodeBase64?: string | null;
  pixExpiraEm?: string | null;
}

const EMPTY_COBRANCA: Cobranca = {
  pagamentoId: null,
  status: null,
  checkoutUrl: null,
  checkoutId: null,
  checkoutReady: false,
  paymentStatus: null,
  pixBrCode: null,
  pixQrCodeBase64: null,
  pixExpiraEm: null,
};

/**
 * Status da cobrança de uma solicitação. 404 = ainda sem cobrança → devolve
 * um estado vazio para a UI oferecer "gerar cobrança".
 *
 * `opts.pollMs` força um refetch nesse intervalo enquanto o status não for
 * `pago` — usado pela tela `/pagamento/concluido` para confirmar o pagamento.
 */
export function useCobranca(solicitacaoId?: string, opts?: { pollMs?: number }) {
  return useQuery({
    queryKey: ['cobranca', solicitacaoId],
    queryFn: async (): Promise<Cobranca> => {
      try {
        const r = await apiClient.request<Cobranca>(
          `/v1/solicitacoes/${solicitacaoId}/pagamento`,
        );
        return { ...EMPTY_COBRANCA, ...r };
      } catch {
        return EMPTY_COBRANCA;
      }
    },
    enabled: !!solicitacaoId,
    refetchInterval: (q) => {
      const data = q.state.data as Cobranca | undefined;
      const s = data?.status;
      if (s === 'pago') return false;
      if (opts?.pollMs) return opts.pollMs;
      // PIX no ar (ou sendo gerado): acompanha de perto — o cliente está olhando o QR Code.
      if (data?.pixBrCode || s === 'criando') return 1000 * 3;
      return s === 'pendente' ? 1000 * 15 : false;
    },
  });
}

/**
 * Gera (ou reenvia) a cobrança de uma solicitação. Idempotente no backend:
 * 1 cobrança aberta por solicitação — rechamar devolve a existente e o link.
 */
export function useCriarCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (solicitacaoId: string) => {
      const r = await apiClient.request<Cobranca>(
        `/v1/solicitacoes/${solicitacaoId}/pagamento`,
        { method: 'POST' },
      );
      return { ...EMPTY_COBRANCA, ...r };
    },
    onSuccess: (_d, solicitacaoId) => {
      qc.invalidateQueries({ queryKey: ['cobranca', solicitacaoId] });
    },
  });
}

/**
 * Gera (ou reaproveita) o PIX transparente da solicitação B2C. Assíncrono: responde 202 e o QR
 * chega pelo polling de {@link useCobranca}. Idempotente — PIX vigente é reaproveitado; expirado, regenerado.
 */
export function useCriarPix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (solicitacaoId: string) => {
      const r = await apiClient.request<Cobranca>(
        `/v1/solicitacoes/${solicitacaoId}/pagamento/pix`,
        { method: 'POST' },
      );
      return { ...EMPTY_COBRANCA, ...r };
    },
    onSuccess: (_d, solicitacaoId) => {
      qc.invalidateQueries({ queryKey: ['cobranca', solicitacaoId] });
    },
  });
}
