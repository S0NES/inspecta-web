/**
 * Máscaras de digitação para os formulários. Aplicadas no `onChange` — cortam o
 * excesso de dígitos e formatam progressivamente. A forma persistida (só dígitos)
 * é obtida pelos `normalize*` de `pessoaDocumento.ts`.
 */

const digitos = (v: string) => v.replace(/\D/g, '');

/** `000.000.000-00` */
export function maskCpf(v: string): string {
  const d = digitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** `00.000.000/0000-00` */
export function maskCnpj(v: string): string {
  const d = digitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

/** CPF ou CNPJ conforme a quantidade de dígitos (campo `cpf_cnpj`). */
export function maskCpfCnpj(v: string): string {
  return digitos(v).length > 11 ? maskCnpj(v) : maskCpf(v);
}

/** `(00) 0000-0000` (fixo) ou `(00) 00000-0000` (celular). */
export function maskPhone(v: string): string {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^\((\d{2})\) (\d{4})(\d)/, '($1) $2-$3');
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^\((\d{2})\) (\d{5})(\d)/, '($1) $2-$3');
}

/** `00000-000` */
export function maskCep(v: string): string {
  return digitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}
