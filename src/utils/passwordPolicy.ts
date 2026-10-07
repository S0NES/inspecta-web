import { getTranslations } from '../i18n';

/**
 * Mesma regra aplicada pelo backend (PasswordPolicy.java) — mantida em sincronia manualmente,
 * já que não há um pacote compartilhado entre inspecta-web e inspecta-api para isso. Validar aqui só evita
 * uma ida ao servidor para um erro óbvio; o backend é a fonte de verdade.
 */
export interface RegraSenha {
  label: string;
  valido: (senha: string) => boolean;
}

const regras = getTranslations().password.rules;

export const REGRAS_SENHA: RegraSenha[] = [
  { label: regras.length, valido: (s) => s.length >= 5 && s.length <= 50 },
  { label: regras.upper, valido: (s) => /[A-Z]/.test(s) },
  { label: regras.lower, valido: (s) => /[a-z]/.test(s) },
  { label: regras.special, valido: (s) => /[^A-Za-z0-9]/.test(s) },
];

export function senhaAtendePolitica(senha: string): boolean {
  return REGRAS_SENHA.every((regra) => regra.valido(senha));
}
