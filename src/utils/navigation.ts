import type { Role } from '../store/useAppStore';
import type { IconName } from '../components/shared/Icon';
import { getTranslations } from '../i18n';

const nav = getTranslations().nav;

export interface NavItem {
  /** Path de destino (React Router). */
  to: string;
  label: string;
  icon: IconName;
  /**
   * Perfis (granulares, não o `Role` do frontend) autorizados a ver este item.
   * Ausente = todo mundo do bucket de `Role` já é elegível. Usado para diferenciar
   * gerência de operação/cliente dentro do bucket `corretor`.
   */
  perfis?: string[];
}

/**
 * Grupo expansível na barra lateral. O cabeçalho do grupo NÃO navega — só
 * abre/fecha a lista de filhos. Usado para "Configurações" (só admin/suporte).
 */
export interface NavGroup {
  group: string;
  label: string;
  icon: IconName;
  children: NavItem[];
}

export type NavNode = NavItem | NavGroup;

export const isGroup = (n: NavNode): n is NavGroup => 'group' in n;

export const navMap: Record<Role, NavNode[]> = {
  corretor: [
    { to: '/dashboard', label: nav.items.dashboard, icon: 'dashboard' },
    { to: '/requests', label: nav.items.requests, icon: 'requests' },
    { to: '/requests/new', label: nav.items.requestsNew, icon: 'plus' },
    { to: '/properties', label: nav.items.properties, icon: 'properties' },
    { to: '/laudos', label: nav.items.laudos, icon: 'reports' },
    { to: '/extrato', label: nav.items.extrato, icon: 'extrato' },
    // Só gerência: vê a equipe (usuários de operação) da própria imobiliária.
    { to: '/usuarios', label: nav.items.usuarios, icon: 'users', perfis: ['imob_gerencia'] },
  ],
  vistoriador: [
    { to: '/dashboard', label: nav.items.dashboard, icon: 'dashboard' },
    // Mesma entrada de fila que admin/corretor já têm — /requests substituiu a
    // antiga lista /inspections como fila do vistoriador.
    { to: '/requests', label: nav.items.requests, icon: 'requests' },
    { to: '/laudos', label: nav.items.laudos, icon: 'reports' },
    { to: '/earnings', label: nav.items.extrato, icon: 'extrato' },
  ],
  // B2C — cliente final. Fase 1 (telas 1-2) tinha só o Painel; "Solicitar vistoria"
  // (fluxo do cliente pedindo o próprio serviço) chegou na Fase 4 (tela 4).
  cliente: [
    { to: '/dashboard', label: nav.items.dashboard, icon: 'dashboard' },
    { to: '/solicitar', label: nav.items.solicitar, icon: 'plus' },
  ],
  admin: [
    { to: '/dashboard', label: nav.items.dashboard, icon: 'dashboard' },
    { to: '/requests', label: nav.items.requests, icon: 'requests' },
    { to: '/properties', label: nav.items.properties, icon: 'properties' },
    { to: '/laudos', label: nav.items.laudos, icon: 'reports' },
    { to: '/extrato', label: nav.items.extrato, icon: 'extrato' },
    { to: '/agencies', label: nav.items.agencies, icon: 'clients' },
    { to: '/clientes', label: nav.items.clientes, icon: 'user' },
    { to: '/usuarios', label: nav.items.usuarios, icon: 'users' },
    { to: '/cities', label: nav.items.cities, icon: 'cities' },
    {
      group: 'config',
      label: nav.groups.config,
      icon: 'settings',
      children: [
        { to: '/settings/tipagem', label: nav.config.tipagem, icon: 'tipagem' },
        { to: '/settings/biletagem-cliente', label: nav.config.biletagemCliente, icon: 'extrato' },
        { to: '/settings/integracoes', label: nav.config.integracoes, icon: 'pleno' },
        { to: '/settings/api-keys', label: nav.config.apiKeys, icon: 'api-keys' },
        { to: '/settings/templates', label: nav.config.templates, icon: 'reports' },
        { to: '/settings/utilities', label: nav.config.utilities, icon: 'utilities' },
      ],
    },
  ],
};

const permiteItem = (item: NavItem, perfil?: string | null): boolean =>
  !item.perfis || (!!perfil && item.perfis.includes(perfil));

/**
 * Itens de navegação do `role` (bucket grosso), com um recorte fino opcional por
 * `perfil` (ex.: dentro de `corretor`, só `imob_gerencia` vê "Usuários"). Sem
 * `perfil`, itens restritos ficam de fora — mais seguro que mostrar por padrão.
 */
export const getNavItems = (role: Role, perfil?: string | null): NavNode[] =>
  navMap[role]
    .map((n) => (isGroup(n) ? { ...n, children: n.children.filter((c) => permiteItem(c, perfil)) } : n))
    .filter((n) => (isGroup(n) ? true : permiteItem(n, perfil)));

/** Só os itens folha (grupos achatados) — para lookup de rótulo/ícone. */
export const flattenNavItems = (role: Role, perfil?: string | null): NavItem[] =>
  getNavItems(role, perfil).flatMap((n) => (isGroup(n) ? n.children : [n]));

/** Um degrau da trilha. Sem `to`, é o degrau atual e não navega. */
export interface Crumb {
  label: string;
  to?: string;
}

const ROOT: Crumb = { label: nav.root, to: '/dashboard' };

/** Rótulo + path da seção "mãe" de cada primeiro segmento de path. */
const SECTION: Record<string, { label: string; path: string }> = {
  requests: { label: nav.items.requests, path: '/requests' },
  properties: { label: nav.items.properties, path: '/properties' },
  agencies: { label: nav.items.agencies, path: '/agencies' },
  clientes: { label: nav.items.clientes, path: '/clientes' },
  usuarios: { label: nav.items.usuarios, path: '/usuarios' },
  laudos: { label: nav.items.laudos, path: '/laudos' },
  extrato: { label: nav.items.extrato, path: '/extrato' },
  earnings: { label: nav.items.extrato, path: '/earnings' },
  cities: { label: nav.items.cities, path: '/cities' },
  solicitar: { label: nav.items.solicitar, path: '/solicitar' },
  profile: { label: nav.items.profile, path: '/profile' },
  vistoriadores: { label: nav.items.vistoriadores, path: '/vistoriadores' },
  // /solicitacoes/:id/pagar — URL de contrato, mas a seção na trilha é Solicitações.
  solicitacoes: { label: nav.items.requests, path: '/requests' },
};

/** Rótulo do último degrau para paths conhecidos de sub-tela / config. */
const LEAF_LABEL: Record<string, string> = {
  '/requests/new': nav.breadcrumb.create,
  '/properties/new': nav.breadcrumb.register,
  '/agencies/new': nav.breadcrumb.newAgency,
  '/settings/tipagem': nav.config.tipagem,
  '/settings/biletagem-cliente': nav.config.biletagemCliente,
  '/settings/pleno': nav.config.integracoes,
  '/settings/integracoes': nav.config.integracoes,
  '/settings/api-keys': nav.config.apiKeys,
  '/settings/templates': nav.config.templates,
  '/settings/utilities': nav.config.utilities,
};

/**
 * Trilha hierárquica do cabeçalho a partir do pathname atual:
 * "Inspecta Vistorias / Solicitações / Criar". Todo degrau menos o último navega
 * (`to`); o último é a tela corrente.
 */
export const getBreadcrumb = (pathname: string, _role: Role): Crumb[] => {
  void _role;
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/dashboard') return [{ label: nav.root }];

  const segs = clean.split('/').filter(Boolean);
  const first = segs[0];

  if (first === 'settings') {
    if (segs[1] === 'templates' && segs.length > 2) {
      const isNew = segs[segs.length - 1] === 'new';
      return [
        ROOT,
        { label: nav.breadcrumb.config, to: '/dashboard' },
        { label: nav.config.templates, to: '/settings/templates' },
        { label: isNew ? nav.breadcrumb.create : nav.breadcrumb.edit },
      ];
    }
    return [ROOT, { label: nav.breadcrumb.config, to: '/dashboard' }, { label: LEAF_LABEL[clean] ?? nav.breadcrumb.config }];
  }

  const section = SECTION[first];

  if (section && segs.length === 2 && segs[1] === 'new') {
    return [ROOT, { label: section.label, to: section.path }, { label: LEAF_LABEL[clean] ?? nav.breadcrumb.new }];
  }

  if (section && segs.length === 3 && segs[2] === 'edit') {
    const editLabel = first === 'agencies' ? nav.breadcrumb.editAgency : nav.breadcrumb.edit;
    return [ROOT, { label: section.label, to: section.path }, { label: editLabel }];
  }

  if (first === 'inspections' && segs.length === 2) {
    // A lista /inspections saiu; o degrau do meio volta para /requests (a fila).
    return [ROOT, { label: nav.items.requests, to: '/requests' }, { label: nav.breadcrumb.inspectionField }];
  }

  if (first === 'solicitacoes') {
    return [ROOT, { label: nav.items.requests, to: '/requests' }, { label: nav.breadcrumb.payment }];
  }

  if (section) return [ROOT, { label: section.label }];
  return [ROOT, { label: nav.root }];
};
