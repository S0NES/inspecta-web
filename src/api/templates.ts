import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Hooks da feature de Templates (P2 — só ADMIN/SUPORTE).
 *
 * E-mail: templates de mensagem versionados por UUID (`/v1/notify/templates`).
 * PDF: templates de documento/laudo versionados por id (`/v1/pdf-templates`).
 */

export interface EmailTemplate {
  uuid: string;
  versao: number;
  canal: string;
  nome: string;
  assunto: string | null;
  corpo: string;
  ativo: boolean;
  atualizadoEm: string;
}

export interface PdfTemplate {
  id: string;
  uuid: string;
  chave: string;
  imobiliariaId: string | null;
  versao: number;
  nome: string;
  html: string;
  css: string | null;
  ativo: boolean;
  atualizadoEm: string;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['templates', 'email'],
    queryFn: () => apiClient.request<EmailTemplate[]>('/v1/notify/templates?canal=email'),
    retry: 1,
  });
}

export function usePdfTemplates() {
  return useQuery({
    queryKey: ['templates', 'pdf'],
    queryFn: () => apiClient.request<PdfTemplate[]>('/v1/pdf-templates'),
    retry: 1,
  });
}

/**
 * Cria um template de e-mail novo (sem `uuid`) ou publica uma nova versão de um
 * existente (`uuid` presente). O backend nunca sobrescreve a versão anterior.
 */
export function useSaveEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: { uuid?: string; canal: string; nome: string; assunto: string; corpo: string }) => {
      const body = JSON.stringify({ canal: t.canal, nome: t.nome, assunto: t.assunto, corpo: t.corpo });
      return t.uuid
        ? apiClient.request<EmailTemplate>(`/v1/notify/templates/${t.uuid}/versao`, { method: 'POST', body })
        : apiClient.request<EmailTemplate>('/v1/notify/templates', { method: 'POST', body });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates', 'email'] }),
  });
}

/** Grava um template PDF (sempre cria nova versão; 422 traz a lista `erros`). */
export function useSavePdfTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: { chave: string; nome: string; html: string; css?: string; imobiliariaId?: string | null }) =>
      apiClient.request<PdfTemplate>('/v1/pdf-templates', {
        method: 'POST',
        body: JSON.stringify(t),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates', 'pdf'] }),
  });
}

export function useDeactivateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) =>
      apiClient.request<void>(`/v1/notify/templates/${uuid}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates', 'email'] }),
  });
}

export function useDeactivatePdfTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.request<void>(`/v1/pdf-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates', 'pdf'] }),
  });
}

/**
 * Enfileira um template de e-mail para uma lista de endereços (idempotente por
 * destinatário). O envio direto a partir da tela do template usa `emails`;
 * `usuarioIds` continua aceito para chamadas internas.
 */
export function useSendTemplate() {
  return useMutation({
    mutationFn: ({ uuid, emails, usuarioIds }: { uuid: string; emails?: string[]; usuarioIds?: string[] }) =>
      apiClient.request<{ enfileirados: number; ignorados?: number }>(`/v1/notify/templates/${uuid}/enviar`, {
        method: 'POST',
        body: JSON.stringify({ emails, usuarioIds }),
      }),
  });
}

/**
 * Utilidades transacionais (reset de senha, convite, …) e o template de e-mail vinculado a
 * cada uma. Uma utilidade sempre tem exatamente um template.
 */
export interface TemplateUtilidade {
  utilidade: string;
  rotulo: string;
  variaveis: string[];
  templateId: string;
  templateNome: string;
}

export function useTemplateUtilidades() {
  return useQuery({
    queryKey: ['templates', 'utilidades'],
    queryFn: () => apiClient.request<TemplateUtilidade[]>('/v1/notify/templates/utilidades'),
    retry: 1,
  });
}

/** Aponta uma utilidade para outro template de e-mail. Só ADMIN — o backend devolve 403. */
export function useSetTemplateUtilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ utilidade, templateId }: { utilidade: string; templateId: string }) =>
      apiClient.request<void>(`/v1/notify/templates/utilidades/${utilidade}`, {
        method: 'PUT',
        body: JSON.stringify({ templateId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates', 'utilidades'] }),
  });
}
