import { describe, test, expect } from 'vitest';
import { navMap, getNavItems, flattenNavItems, isGroup, getBreadcrumb } from '../../utils/navigation';
import type { Role } from '../../store/useAppStore';

describe('navigation.ts', () => {
  describe('navMap', () => {
    test('has four roles defined', () => {
      expect(Object.keys(navMap)).toHaveLength(4);
      expect(navMap).toHaveProperty('corretor');
      expect(navMap).toHaveProperty('vistoriador');
      expect(navMap).toHaveProperty('admin');
      expect(navMap).toHaveProperty('cliente');
    });

    test('corretor has expected nav items (flat, path-based)', () => {
      const items = flattenNavItems('corretor');
      expect(items[0]).toEqual({ to: '/dashboard', label: 'Painel', icon: 'dashboard' });
      expect(items.some((i) => i.to === '/requests')).toBe(true);
      expect(items.some((i) => i.to === '/requests/new')).toBe(true);
      expect(items.some((i) => i.to === '/properties')).toBe(true);
      // corretor não tem grupos
      expect(navMap.corretor.some(isGroup)).toBe(false);
    });

    test('vistoriador has expected nav items', () => {
      const items = flattenNavItems('vistoriador');
      expect(items[0]).toEqual({ to: '/dashboard', label: 'Painel', icon: 'dashboard' });
      // A lista /inspections saiu; a fila do vistoriador agora é /requests (mesma entrada de admin/corretor).
      expect(items.some((i) => i.to === '/requests')).toBe(true);
      expect(items.some((i) => i.to === '/inspections')).toBe(false);
      expect(items.some((i) => i.to === '/laudos')).toBe(true);
      expect(items.some((i) => i.to === '/audit')).toBe(false);
      expect(items.some((i) => i.to === '/earnings')).toBe(true);
    });

    test('admin has the "Configurações" group pointing at /settings/* (Usuários mudou para /usuarios)', () => {
      const grupo = navMap.admin.find(isGroup);
      expect(grupo?.group).toBe('config');
      expect(grupo?.children.map((c) => c.to)).toEqual([
        '/settings/tipagem',
        '/settings/biletagem-cliente',
        '/settings/integracoes',
        '/settings/api-keys',
        '/settings/templates',
        '/settings/utilities',
      ]);
    });

    test('admin sees /usuarios as a top-level item (Real Estate › Usuários)', () => {
      const flat = flattenNavItems('admin').map((i) => i.to);
      expect(flat).toContain('/usuarios');
    });

    test('corretor only sees /usuarios when perfil is imob_gerencia', () => {
      expect(flattenNavItems('corretor').some((i) => i.to === '/usuarios')).toBe(false);
      expect(flattenNavItems('corretor', 'imob_operacao').some((i) => i.to === '/usuarios')).toBe(false);
      expect(flattenNavItems('corretor', 'imob_gerencia').some((i) => i.to === '/usuarios')).toBe(true);
    });

    test('Vistoriadores is not a standalone admin nav item (lives in Real Estate)', () => {
      const flat = flattenNavItems('admin').map((i) => i.to);
      expect(flat).not.toContain('/vistoriadores');
    });

    test('admin flat items include /agencies, /cities; not /agencies/new', () => {
      const flat = flattenNavItems('admin').map((i) => i.to);
      expect(flat).toContain('/agencies');
      expect(flat).toContain('/cities');
      expect(flat).toContain('/settings/tipagem');
      expect(flat).not.toContain('/agencies/new');
    });
  });

  describe('getBreadcrumb', () => {
    test('dashboard is a single non-navigable crumb', () => {
      expect(getBreadcrumb('/dashboard', 'admin')).toEqual([{ label: 'Inspecta Vistorias' }]);
      expect(getBreadcrumb('/', 'admin')).toEqual([{ label: 'Inspecta Vistorias' }]);
    });

    test('a top-level page shows root + section', () => {
      const crumbs = getBreadcrumb('/requests', 'corretor');
      expect(crumbs.map((c) => c.label)).toEqual(['Inspecta Vistorias', 'Solicitações']);
      expect(crumbs[0].to).toBe('/dashboard');
      expect(crumbs[1].to).toBeUndefined();
    });

    test('a "new" sub-page shows a clickable section crumb', () => {
      const crumbs = getBreadcrumb('/requests/new', 'corretor');
      expect(crumbs.map((c) => c.label)).toEqual(['Inspecta Vistorias', 'Solicitações', 'Criar']);
      expect(crumbs[1].to).toBe('/requests');
      expect(crumbs[2].to).toBeUndefined();
    });

    test('an edit sub-page derives the section from the pathname', () => {
      const crumbs = getBreadcrumb('/properties/42/edit', 'corretor');
      expect(crumbs.map((c) => c.label)).toEqual(['Inspecta Vistorias', 'Imóveis', 'Editar']);
      expect(crumbs[1].to).toBe('/properties');
    });

    test('a settings page shows the "Configurações" crumb that navigates home', () => {
      const crumbs = getBreadcrumb('/settings/tipagem', 'admin');
      expect(crumbs.map((c) => c.label)).toEqual(['Inspecta Vistorias', 'Configurações', 'Tipagem']);
      expect(crumbs[0].to).toBe('/dashboard');
      expect(crumbs[1].to).toBe('/dashboard');
      expect(crumbs[2].to).toBeUndefined();
    });

    test('template create/edit pages add a Templates crumb that returns to the list', () => {
      const criar = getBreadcrumb('/settings/templates/email/new', 'admin');
      expect(criar.map((c) => c.label)).toEqual(['Inspecta Vistorias', 'Configurações', 'Templates', 'Criar']);
      expect(criar[2].to).toBe('/settings/templates');
      expect(criar[3].to).toBeUndefined();

      const editar = getBreadcrumb('/settings/templates/pdf/5/edit', 'admin');
      expect(editar.map((c) => c.label)).toEqual(['Inspecta Vistorias', 'Configurações', 'Templates', 'Editar']);
      expect(editar[2].to).toBe('/settings/templates');
    });

    test('the inspection detail crumb points back to Solicitações (the list /inspections was removed)', () => {
      const crumbs = getBreadcrumb('/inspections/1042', 'admin');
      expect(crumbs.map((c) => c.label)).toEqual(['Inspecta Vistorias', 'Solicitações', 'Vistoria em campo']);
      expect(crumbs[1].to).toBe('/requests');
    });

    test('the payment contract URL maps its section to Solicitações', () => {
      const crumbs = getBreadcrumb('/solicitacoes/7/pagar', 'corretor');
      expect(crumbs.map((c) => c.label)).toEqual(['Inspecta Vistorias', 'Solicitações', 'Pagamento']);
      expect(crumbs[1].to).toBe('/requests');
    });
  });

  describe('edge cases', () => {
    test('all flat nav items have to, label, and non-empty icon', () => {
      (['corretor', 'vistoriador', 'admin'] as Role[]).forEach((role) => {
        flattenNavItems(role).forEach((item) => {
          expect(item.to.startsWith('/')).toBe(true);
          expect(item.label.length).toBeGreaterThan(0);
          expect(item.icon.length).toBeGreaterThan(0);
        });
      });
    });

    test('dashboard is first node in all roles', () => {
      (['corretor', 'vistoriador', 'admin'] as Role[]).forEach((role) => {
        const first = getNavItems(role)[0];
        expect(isGroup(first) ? null : first.to).toBe('/dashboard');
      });
    });

    test('profile is not a navigable nav item in any role', () => {
      (['corretor', 'vistoriador', 'admin'] as Role[]).forEach((role) => {
        expect(flattenNavItems(role).some((i) => i.to === '/profile')).toBe(false);
      });
    });
  });
});
