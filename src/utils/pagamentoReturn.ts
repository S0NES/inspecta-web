/**
 * Lê o id da solicitação da query string das landings de pagamento
 * (`/pagamento/retorno` e `/pagamento/concluido`).
 *
 * O backend monta `returnUrl` / `completionUrl` apontando para essas rotas; o
 * parâmetro deve ser `?solicitacao=<id>`, mas aceitamos `solicitacaoId`, `id` e
 * `externalId` como fallback caso o provedor (ou o backend) troque o nome —
 * codificação defensiva pedida no brief.
 */
export function solicitacaoIdFromUrl(search: string = window.location.search): string | null {
  const p = new URLSearchParams(search);
  for (const key of ['solicitacao', 'solicitacaoId', 'id', 'externalId']) {
    const v = p.get(key);
    if (v && v.trim() !== '') return v.trim();
  }
  return null;
}
