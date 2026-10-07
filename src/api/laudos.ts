import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

// Type definitions based on backend controllers
export interface Laudo {
  id: string;
  servicoId: string;
  conteudoJson: string;
  status: 'RASCUNHO' | 'FINALIZADO' | 'ASSINADO';
  criadoEm: string;
  atualizadoEm: string;
}

/** Quem vai assinar um laudo — GET /v1/laudos/{id}/assinantes. Vem de solicitacao_intervenientes. */
export interface Assinante {
  nome: string;
  papel: string;
  email: string;
}

/**
 * GET /v1/relatorios/imobiliaria — espelha `RelatorioService.RelatorioImobiliaria` (inspecta-api).
 * O backend não devolve comissão nem linhas por período; ler campos inexistentes era o que
 * derrubava a tela inteira (RELATORIO.md achado #1).
 */
export interface RelatorioImobiliaria {
  imobiliariaId: string;
  mes: string;
  /** Nº de serviços faturáveis no mês. */
  volume: number;
  /** Soma dos preços-snapshot dos serviços do mês. */
  faturamento: number;
  /** Piso contratual; `null` quando o contrato não tem mínimo. */
  faturamentoMinimo: number | null;
  /** `true` quando `faturamento < faturamentoMinimo`. */
  minimoAplicado: boolean;
  /** O que será cobrado: `max(faturamento, faturamentoMinimo)`. */
  faturamentoCobrado: number;
}

/**
 * Laudo enriquecido — GET /v1/laudos (LaudoResponse, inspecta-api).
 * O backend resolve tamanho/mime do PDF (via pdfArquivoId) e a contagem de fotos da
 * solicitação associada, então a tela não precisa adivinhar esses campos.
 */
/**
 * Origem do PDF do laudo (`LaudoResponse.origem`, inspecta-api / `Laudo.Origem`, inspecta-core).
 * `gerado_internamente` = pipeline interno OpenHTML2PDF; `importado_pleno` = PDF já pronto
 * baixado da Pleno pelo Worker. Campo pode vir `null` em respostas legadas.
 */
export type LaudoOrigem = 'gerado_internamente' | 'importado_pleno';

export interface LaudoResumo {
  id: string;
  solicitacaoServicoId: string;
  versao: number;
  status: 'RASCUNHO' | 'FINALIZADO' | 'ASSINADO';
  origem: LaudoOrigem | null;
  criadoEm: string;
  assinadoEm: string | null;
  arquivoTamanho: number | null;
  arquivoMime: string | null;
  fotosCount: number;
}

interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export function useLaudos(filters?: {
  solicitacaoServicoId?: string;
  status?: string;
  origem?: LaudoOrigem;
  page?: number;
  size?: number;
}) {
  const params = new URLSearchParams();
  params.append('page', String(filters?.page ?? 0));
  params.append('size', String(filters?.size ?? 50));
  if (filters?.solicitacaoServicoId) params.append('solicitacaoServicoId', String(filters.solicitacaoServicoId));
  if (filters?.status) params.append('status', filters.status);
  if (filters?.origem) params.append('origem', filters.origem);

  return useQuery({
    queryKey: ['laudos', filters],
    queryFn: async () => apiClient.request<PagedResponse<LaudoResumo>>(`/v1/laudos?${params.toString()}`),
    retry: 1,
  });
}

// Laudos — individual operations

export function useLaudo(laudoId: string) {
  return useQuery({
    queryKey: ['laudo', laudoId],
    queryFn: async () =>
      apiClient.request<Laudo>(`/v1/laudos/${laudoId}`),
    enabled: !!laudoId,
  });
}

export function useCreateLaudo() {
  return useMutation({
    mutationFn: async (servicoId: string) =>
      apiClient.request<Laudo>(
        '/v1/laudos',
        {
          method: 'POST',
          body: JSON.stringify({ servicoId }),
        }
      ),
  });
}

export function useUpdateLaudo() {
  return useMutation({
    mutationFn: async ({ laudoId, conteudoJson }: { laudoId: string; conteudoJson: string }) =>
      apiClient.request<Laudo>(
        `/v1/laudos/${laudoId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ conteudoJson }),
        }
      ),
  });
}

export function useFinalizeLaudo() {
  return useMutation({
    mutationFn: async (laudoId: string) =>
      apiClient.request<void>(
        `/v1/laudos/${laudoId}/finalizar`,
        { method: 'POST' }
      ),
  });
}

export function useNovaVersaoLaudo() {
  return useMutation({
    mutationFn: async (laudoId: string) =>
      apiClient.request<Laudo>(
        `/v1/laudos/${laudoId}/nova-versao`,
        { method: 'POST' }
      ),
  });
}

/**
 * Assinantes gravados na solicitação do laudo — o que o Assinafy usa como signatários.
 * A tela não pede mais e-mails soltos.
 */
export function useLaudoAssinantes(laudoId: string | null | undefined) {
  return useQuery({
    queryKey: ['laudo-assinantes', laudoId],
    queryFn: async () => apiClient.request<Assinante[]>(`/v1/laudos/${laudoId}/assinantes`),
    enabled: !!laudoId,
  });
}

/**
 * Solicita assinatura de um laudo. O backend monta os signatários a partir de
 * `solicitacao_intervenientes` — o corpo é ignorado (enviamos `[]`).
 */
export function useRequestSignature() {
  return useMutation({
    mutationFn: async ({ tipo, id }: { tipo: string; id: string }) =>
      apiClient.request<void>(
        `/v1/documentos/${tipo}/${id}/assinar`,
        { method: 'POST', body: '[]' },
      ),
  });
}

// Relatórios — financial reports
export function useRelatorioImobiliaria(mes: string, imobiliariaId?: string) {
  return useQuery({
    queryKey: ['relatorio-imobiliaria', mes, imobiliariaId],
    queryFn: async () => {
      const params = new URLSearchParams({ mes });
      if (imobiliariaId) {
        params.append('imobiliariaId', String(imobiliariaId));
      }
      return apiClient.request<RelatorioImobiliaria>(
        `/v1/relatorios/imobiliaria?${params}`
      );
    },
    enabled: !!mes,
  });
}
