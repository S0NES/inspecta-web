/**
 * Verificador único de CPF, e-mail e nome completo — espelho EXATO de
 * `br.com.vistoria.core.shared.validation.PessoaDocumento` (inspecta-core).
 * O que passa aqui passa no inspecta-api. Códigos de erro estáveis e iguais nos dois lados.
 */

export const CPF_INVALIDO = 'cpf_invalido';
export const CNPJ_INVALIDO = 'cnpj_invalido';
export const EMAIL_INVALIDO = 'email_invalido';
export const TELEFONE_INVALIDO = 'telefone_invalido';
export const NOME_COMPLETO_INVALIDO = 'nome_completo_invalido';

/** RFC 5321: teto de um endereço de e-mail. */
export const EMAIL_MAX = 254;

/** DDDs válidos no Brasil — espelho de `PessoaDocumento.DDDS_VALIDOS` (Java). */
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Regex de e-mail — IDÊNTICA à do Java: local-part + `@` + domínio com ponto; sem espaço.
 * Sem verificação de MX. `^[^\s@]+@[^\s@]+\.[^\s@]+$`
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


/** Aceita `000.000.000-00` ou só dígitos. Recusa vazio, ≠11 dígitos, todos iguais, DV mód-11 inválido. */
export function isCpf(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const d = raw.replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const n = d.split('').map(Number);
  return n[9] === dv(n, 9, 10) && n[10] === dv(n, 10, 11);
}

/** Os 11 dígitos do CPF (a forma persistida). Lança `Error(CPF_INVALIDO)` se inválido. */
export function normalizeCpf(raw: string | null | undefined): string {
  if (!isCpf(raw)) throw new Error(CPF_INVALIDO);
  return (raw as string).replace(/\D/g, '');
}

/** DV mód-11 — mesmo critério de `DadosFalsos.dv` / `PessoaDocumento.dv`. */
function dv(n: number[], len: number, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < len; i++) soma += n[i] * (pesoInicial - i);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}


/** Aceita `00.000.000/0000-00` ou só dígitos. Recusa vazio, ≠14 dígitos, todos iguais, DV mód-11 inválido. */
export function isCnpj(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const n = d.split('').map(Number);
  return n[12] === dvCnpj(n, 12) && n[13] === dvCnpj(n, 13);
}

/** Os 14 dígitos do CNPJ (a forma persistida). Lança `Error(CNPJ_INVALIDO)` se inválido. */
export function normalizeCnpj(raw: string | null | undefined): string {
  if (!isCnpj(raw)) throw new Error(CNPJ_INVALIDO);
  return (raw as string).replace(/\D/g, '');
}

/** DV mód-11 do CNPJ: pesos cíclicos 2..9 da direita para a esquerda. Espelho de `PessoaDocumento.dvCnpj`. */
function dvCnpj(n: number[], len: number): number {
  let soma = 0;
  let peso = 2;
  for (let i = len - 1; i >= 0; i--) {
    soma += n[i] * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}


/** 10 (fixo) ou 11 (celular) dígitos, DDD válido; celular exige o 9 na 3ª posição. */
export function isPhoneBr(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10 && d.length !== 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  if (!DDDS_VALIDOS.has(Number(d.slice(0, 2)))) return false;
  return d.length !== 11 || d[2] === '9';
}

/** Os 10-11 dígitos do telefone (a forma persistida). Lança `Error(TELEFONE_INVALIDO)` se inválido. */
export function normalizePhone(raw: string | null | undefined): string {
  if (!isPhoneBr(raw)) throw new Error(TELEFONE_INVALIDO);
  return (raw as string).replace(/\D/g, '');
}


export function isEmail(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const e = raw.trim();
  return e.length > 0 && e.length <= EMAIL_MAX && EMAIL_RE.test(e);
}

/** E-mail em lower-case (a forma persistida). Lança `Error(EMAIL_INVALIDO)` se inválido. */
export function normalizeEmail(raw: string | null | undefined): string {
  if (!isEmail(raw)) throw new Error(EMAIL_INVALIDO);
  return (raw as string).trim().toLowerCase();
}


/** trim; ≥2 palavras com ≥2 letras cada. Mesma regra do Java. */
export function isNomeCompleto(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const partes = raw.trim().split(/\s+/).filter(Boolean);
  const ok = partes.filter((p) => (p.match(/\p{L}/gu) ?? []).length >= 2).length;
  return ok >= 2;
}

export function requireNomeCompleto(raw: string | null | undefined): string {
  if (!isNomeCompleto(raw)) throw new Error(NOME_COMPLETO_INVALIDO);
  return (raw as string).trim();
}
