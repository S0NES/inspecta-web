/**
 * Normalização de texto para comparação tolerante a acento/caixa.
 *
 * Usado no casamento entre a cidade que o ViaCEP devolve ("São Paulo") e a cidade
 * cadastrada, que a pessoa pode ter salvo sem acento ("Sao Paulo"). Sem isto o
 * autofill de CEP nunca resolvia a cidade e caía na dica de "cidade não cadastrada".
 */
export function semAcento(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Casa a cidade do ViaCEP (localidade + uf) com a lista cadastrada, ignorando
 * acento e caixa no nome. UF é comparada em caixa baixa.
 */
export function matchCidadePorCep<T extends { nome: string; uf: string }>(
  cidades: T[],
  localidade: string | null | undefined,
  uf: string | null | undefined,
): T | undefined {
  const alvoNome = semAcento(localidade);
  const alvoUf = (uf ?? '').toLowerCase().trim();
  if (!alvoNome) return undefined;
  return cidades.find((c) => semAcento(c.nome) === alvoNome && c.uf.toLowerCase() === alvoUf);
}
