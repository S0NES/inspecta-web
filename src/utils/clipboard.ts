/**
 * Copia texto para a área de transferência sem nunca deixar uma promise rejeitada escapar.
 *
 * `navigator.clipboard.writeText` rejeita com `NotAllowedError` sempre que a permissão de
 * clipboard não está concedida — iframe, contexto http, aba em background, navegador headless.
 * Chamá-la sem `try/catch` gerava um `unhandledrejection` na tela de Templates
 * (RELATORIO.md achado #10). Aqui o erro vira um `false` e quem chama mostra o fallback
 * ("selecione e copie manualmente").
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
