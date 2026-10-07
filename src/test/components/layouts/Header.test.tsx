import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from '../../../components/layouts/Header';
import { useAppStore } from '../../../store/useAppStore';
import * as client from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: {
    atualizarTema: vi.fn().mockResolvedValue({}),
  },
}));

// Mock navigation utility — trilha derivada do pathname.
vi.mock('../../../utils/navigation', () => ({
  getBreadcrumb: vi.fn((pathname: string) => {
    if (pathname === '/dashboard' || pathname === '/') return [{ label: 'Inspecta Vistorias' }];
    if (pathname === '/requests') {
      return [{ label: 'Inspecta Vistorias', to: '/dashboard' }, { label: 'Solicitações' }];
    }
    if (pathname === '/requests/new') {
      return [
        { label: 'Inspecta Vistorias', to: '/dashboard' },
        { label: 'Solicitações', to: '/requests' },
        { label: 'Criar' },
      ];
    }
    return [{ label: 'Inspecta Vistorias' }];
  }),
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}

function renderHeader(initialEntries: string[] = ['/dashboard']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="*" element={<><Header /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

describe('Header', () => {
  beforeEach(() => {
    useAppStore.setState({
      role: 'corretor',
      theme: 'light',
    });
    vi.clearAllMocks();
  });

  it('renders header', () => {
    renderHeader();
    expect(document.querySelector('.header')).toBeInTheDocument();
  });

  it('shows the current route as the last crumb and renders no page heading', () => {
    renderHeader(['/requests']);
    expect(screen.getByLabelText('Trilha de navegação')).toHaveTextContent('Solicitações');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders the breadcrumb trail', () => {
    renderHeader(['/requests/new']);

    const trilha = screen.getByLabelText('Trilha de navegação');
    expect(trilha).toHaveTextContent('Inspecta Vistorias');
    expect(trilha).toHaveTextContent('Solicitações');
    expect(trilha).toHaveTextContent('Criar');
  });

  it('navigates when an ancestor crumb is clicked', async () => {
    const user = userEvent.setup();
    renderHeader(['/requests/new']);

    await user.click(screen.getByRole('link', { name: 'Solicitações' }));
    expect(currentPath()).toBe('/requests');
  });

  it('does not make the current crumb clickable', () => {
    renderHeader(['/requests/new']);

    expect(screen.queryByRole('link', { name: 'Criar' })).not.toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    renderHeader();
    const themeBtn = screen.getAllByRole('button')[0];
    expect(themeBtn).toBeInTheDocument();
  });

  // FRONTEND.md §1 proíbe emoji/glifos: o toggle usa um ícone de traço (Lucide).
  it('shows a stroke icon for light theme', () => {
    useAppStore.setState({ theme: 'light' });
    renderHeader();
    expect(screen.getByTitle('Modo escuro').querySelector('svg')).toBeInTheDocument();
  });

  it('shows a stroke icon for dark theme', () => {
    useAppStore.setState({ theme: 'dark' });
    renderHeader();
    expect(screen.getByTitle('Modo claro').querySelector('svg')).toBeInTheDocument();
  });

  it('has correct title for theme toggle in light mode', () => {
    useAppStore.setState({ theme: 'light' });
    renderHeader();
    expect(screen.getByTitle('Modo escuro')).toBeInTheDocument();
  });

  it('has correct title for theme toggle in dark mode', () => {
    useAppStore.setState({ theme: 'dark' });
    renderHeader();
    expect(screen.getByTitle('Modo claro')).toBeInTheDocument();
  });

  it('calls toggleTheme when theme button clicked', async () => {
    const user = userEvent.setup();
    const toggleThemeSpy = vi.spyOn(useAppStore.getState(), 'toggleTheme');
    renderHeader();

    await user.click(screen.getByTitle('Modo escuro'));
    expect(toggleThemeSpy).toHaveBeenCalled();
    expect(client.apiClient.atualizarTema).toHaveBeenCalledWith('dark');
  });

  it('does not render profile or logout controls', () => {
    renderHeader();

    expect(screen.queryByTitle('Perfil')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
  });

  it('follows the collapsed sidebar', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    const { container } = renderHeader();
    expect(container.querySelector('.header')).toHaveClass('header--collapsed');
  });

  it('updates the trail when the route changes', () => {
    const { unmount } = renderHeader(['/dashboard']);
    expect(screen.getByLabelText('Trilha de navegação')).toHaveTextContent('Inspecta Vistorias');
    unmount();

    renderHeader(['/requests']);
    expect(screen.getByLabelText('Trilha de navegação')).toHaveTextContent('Solicitações');
  });

  it('keeps the theme toggle inside header actions', () => {
    renderHeader();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].parentElement).toHaveClass('header-actions');
  });
});
