import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from '../../../components/layouts/Sidebar';
import { useAppStore } from '../../../store/useAppStore';

// Mock navigation utility (path-based nav map).
vi.mock('../../../utils/navigation', () => ({
  isGroup: (n: any) => 'group' in n,
  getNavItems: vi.fn((role) => {
    if (role === 'corretor') {
      return [
        { to: '/dashboard', label: 'Painel', icon: 'dashboard' },
        { to: '/requests', label: 'Solicitações', icon: 'requests' },
      ];
    }
    if (role === 'vistoriador') {
      return [
        { to: '/dashboard', label: 'Painel', icon: 'dashboard' },
        { to: '/laudos', label: 'Laudos', icon: 'reports' },
      ];
    }
    if (role === 'admin') {
      return [
        { to: '/dashboard', label: 'Painel', icon: 'dashboard' },
        {
          group: 'config', label: 'Configurações', icon: 'settings',
          children: [
            { to: '/settings/users', label: 'Usuários', icon: 'users' },
            { to: '/settings/tipagem', label: 'Tipagem', icon: 'tipagem' },
          ],
        },
      ];
    }
    return [];
  }),
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}

function renderSidebar(initialEntries: string[] = ['/dashboard']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="*" element={<><Sidebar /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

describe('Sidebar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState({
      role: 'corretor',
      sidebarCollapsed: false,
    });
  });

  it('renders sidebar', () => {
    renderSidebar();
    expect(document.querySelector('.sidebar')).toBeInTheDocument();
  });

  it('renders logo when not collapsed', () => {
    useAppStore.setState({ sidebarCollapsed: false });
    renderSidebar();
    expect(document.querySelector('.sidebar-logo')).toBeInTheDocument();
  });

  it('renders compact logo mark when collapsed', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    const mark = document.querySelector('.sidebar-logo-mark');
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveAttribute('src', '/inspecta-simbolo-vermelho.svg');
  });

  it('renders navigation items based on role', () => {
    useAppStore.setState({ role: 'corretor' });
    renderSidebar();
    expect(screen.getByTitle('Painel')).toBeInTheDocument();
    expect(screen.getByTitle('Solicitações')).toBeInTheDocument();
  });

  it('renders different items for different roles', () => {
    const { unmount } = renderSidebar();
    expect(screen.getByTitle('Solicitações')).toBeInTheDocument();
    unmount();

    useAppStore.setState({ role: 'vistoriador' });
    renderSidebar();
    expect(screen.queryByTitle('Solicitações')).not.toBeInTheDocument();
    expect(screen.getByTitle('Laudos')).toBeInTheDocument();
  });

  it('renders nav items as links to their path', () => {
    renderSidebar();
    expect(screen.getByTitle('Solicitações')).toHaveAttribute('href', '/requests');
  });

  it('marks the active route with nav-item--active class', () => {
    renderSidebar(['/requests']);
    const activeItem = document.querySelector('.nav-item--active');
    expect(activeItem).toHaveTextContent('Solicitações');
  });

  it('navigates to the path when a nav item is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar(['/dashboard']);

    await user.click(screen.getByTitle('Solicitações'));
    expect(currentPath()).toBe('/requests');
  });

  it('hides nav labels when collapsed', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    const labels = document.querySelectorAll('.nav-label');
    labels.forEach((label) => {
      expect(label).toHaveStyle({ display: 'none' });
    });
  });

  it('shows nav labels when not collapsed', () => {
    useAppStore.setState({ sidebarCollapsed: false });
    renderSidebar();
    expect(screen.getByText('Painel')).toBeInTheDocument();
  });

  it('renders hamburger toggle', () => {
    renderSidebar();
    const hamburger = document.querySelector('.sidebar-hamburger');
    expect(hamburger).toBeInTheDocument();
    // O hambúrguer agora é um ícone Lucide (SVG), não 3 barras CSS.
    expect(hamburger?.querySelector('svg')).toBeInTheDocument();
  });

  it('labels the hamburger as expand when collapsed', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    expect(screen.getByLabelText('Expandir menu')).toBeInTheDocument();
  });

  it('labels the hamburger as collapse when expanded', () => {
    useAppStore.setState({ sidebarCollapsed: false });
    renderSidebar();
    expect(screen.getByLabelText('Recolher menu')).toBeInTheDocument();
  });

  it('calls toggleSidebar when hamburger clicked', async () => {
    const user = userEvent.setup();
    const toggleSidebarSpy = vi.spyOn(useAppStore.getState(), 'toggleSidebar');
    renderSidebar();

    await user.click(document.querySelector('.sidebar-hamburger') as HTMLElement);
    expect(toggleSidebarSpy).toHaveBeenCalled();
  });

  it('applies sidebar--collapsed class when collapsed', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    expect(document.querySelector('.sidebar')).toHaveClass('sidebar--collapsed');
  });

  it('removes sidebar--collapsed class when not collapsed', () => {
    useAppStore.setState({ sidebarCollapsed: false });
    renderSidebar();
    expect(document.querySelector('.sidebar')).not.toHaveClass('sidebar--collapsed');
  });

  it('renders nav icons for each item', () => {
    renderSidebar();
    const icons = document.querySelectorAll('.nav-icon');
    expect(icons.length).toBeGreaterThan(0);
    expect(icons[0].querySelector('svg')).toBeInTheDocument();
  });

  describe('bloco de perfil do usuário', () => {
    const comUsuario = (perfil: string, email: string, userName: string | null = null) =>
      useAppStore.setState({
        auth: {
          accessToken: 'token',
          userEmail: email,
          userName,
          userId: '2',
          perfil,
          imobiliariaId: '1',
          loginError: null,
        },
      });

    it('mostra nome derivado do email e o perfil traduzido', () => {
      comUsuario('imob_gerencia', 'ana.souza@inspecta.com.br');
      renderSidebar();

      expect(screen.getByText('ana souza')).toBeInTheDocument();
      expect(screen.getByText('Gerência')).toBeInTheDocument();
    });

    it('prefere o nome real (userName) ao nome derivado do email', () => {
      comUsuario('imob_gerencia', 'ana.souza@inspecta.com.br', 'Ana Carolina Souza');
      renderSidebar();

      expect(screen.getByText('Ana Carolina Souza')).toBeInTheDocument();
      expect(screen.queryByText('ana souza')).not.toBeInTheDocument();
      expect(document.querySelector('.profile-avatar')).toHaveTextContent('AC');
    });

    it('monta as iniciais no avatar', () => {
      comUsuario('admin', 'ana.souza@inspecta.com.br');
      renderSidebar();

      expect(document.querySelector('.profile-avatar')).toHaveTextContent('AS');
    });

    it('cai para um rótulo neutro sem usuário autenticado', () => {
      useAppStore.setState({
        auth: {
          accessToken: null,
          userEmail: null,
          userId: null,
          perfil: null,
          imobiliariaId: null,
          loginError: null,
        },
      });
      renderSidebar();

      expect(screen.getByText('Usuário')).toBeInTheDocument();
    });

    it('abre o menu com acesso ao perfil e sair, sem navegar de imediato', async () => {
      const user = userEvent.setup();
      comUsuario('admin', 'admin@inspecta.com.br');
      useAppStore.setState({ sidebarCollapsed: false, theme: 'light' });
      renderSidebar(['/dashboard']);

      expect(screen.queryByText('Sair')).not.toBeInTheDocument();

      await user.click(document.querySelector('.sidebar-profile') as HTMLElement);

      expect(screen.getByText('admin@inspecta.com.br')).toBeInTheDocument();
      expect(screen.getByText('Acessar perfil')).toBeInTheDocument();
      expect(screen.getByText('Sair')).toBeInTheDocument();
      // Abrir o menu não navega por si só.
      expect(currentPath()).toBe('/dashboard');
    });

    it('navega para o perfil e fecha o menu ao clicar em "Acessar perfil"', async () => {
      const user = userEvent.setup();
      comUsuario('admin', 'admin@inspecta.com.br');
      useAppStore.setState({ sidebarCollapsed: false });
      renderSidebar(['/dashboard']);

      await user.click(document.querySelector('.sidebar-profile') as HTMLElement);
      await user.click(screen.getByText('Acessar perfil'));

      expect(currentPath()).toBe('/profile');
      expect(screen.queryByText('Sair')).not.toBeInTheDocument();
    });

    it('expande a sidebar em vez de abrir o menu quando recolhida', async () => {
      const user = userEvent.setup();
      comUsuario('admin', 'admin@inspecta.com.br');
      useAppStore.setState({ sidebarCollapsed: true });
      renderSidebar();

      await user.click(document.querySelector('.sidebar-profile') as HTMLElement);

      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
      expect(screen.queryByText('Sair')).not.toBeInTheDocument();
    });
  });
});
