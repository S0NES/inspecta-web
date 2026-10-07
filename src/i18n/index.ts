import ptBR from './pt-BR.json';

/**
 * Ponto único de acesso às strings da UI. O produto é somente pt-BR hoje (a
 * troca de idioma fica desabilitada/oculta), mas a estrutura — um mapa de
 * `locales` por código — deixa acrescentar um segundo idioma aditivo: basta
 * criar `en-US.json` e registrá-lo no mapa abaixo.
 *
 * Todas as strings visíveis ao usuário vivem em `pt-BR.json`. Componentes leem
 * via `useTranslation()`; código fora de componente (utils, class components)
 * via `getTranslations()`. Strings com variáveis usam `fmt(template, vars)` com
 * placeholders no formato `{chave}`.
 */
export type Locale = 'pt-BR';

export type TranslationShape = typeof ptBR;

export const locales: Record<Locale, TranslationShape> = {
  'pt-BR': ptBR,
};

/** Locale ativo — fixo por enquanto; a troca de idioma está fora de escopo. */
export const activeLocale: Locale = 'pt-BR';

export function getTranslations(locale: Locale = activeLocale): TranslationShape {
  return locales[locale];
}

/**
 * Hook mínimo de i18n. Hoje apenas devolve o dicionário fixo em pt-BR, mas
 * mantém a forma de um hook para que os call-sites não precisem mudar quando
 * a troca de idioma for ligada (ex.: lendo o locale de um store/contexto).
 */
export function useTranslation() {
  return { t: getTranslations(), locale: activeLocale };
}

/**
 * Interpola `{chave}` em `template` com os valores de `vars`. Chave ausente em
 * `vars` fica literal (`{chave}`), o que facilita flagrar erro em teste/dev.
 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}
