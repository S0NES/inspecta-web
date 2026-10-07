import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';

// Mantém o decode real (token base64) mas controla as chamadas de rede.
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      refresh: vi.fn(),
      me: vi.fn(),
    },
  };
});

function makeToken(payload: Record<string, unknown>) {
  return `h.${btoa(JSON.stringify(payload))}.s`;
}

function renderApp(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().logout();
    useAppStore.getState().setTheme('light');
  });

  it('repopulates userName/userEmail from /me after refreshing the session', async () => {
    vi.mocked(apiClient.refresh).mockResolvedValue({
      accessToken: makeToken({ sub: '7', perfil: 'admin', imobiliaria_id: '1', iat: 0, exp: 0 }),
      expiresInSeconds: 3600,
    });
    vi.mocked(apiClient.me).mockResolvedValue({
      id: '7',
      nome: 'Roberta Lima',
      email: 'roberta.lima@inspecta.com.br',
      perfil: 'admin',
      status: 'ativo',
      imobiliariaId: '1',
      criadoEm: '2026-01-01T00:00:00Z',
      tema: 'dark',
    });

    renderApp();

    await waitFor(() => {
      const { auth, theme } = useAppStore.getState();
      expect(auth.userId).toBe('7');
      expect(auth.userName).toBe('Roberta Lima');
      expect(auth.userEmail).toBe('roberta.lima@inspecta.com.br');
      expect(theme).toBe('dark');
    });
  });

  it('still bootstraps the session when /me returns null', async () => {
    vi.mocked(apiClient.refresh).mockResolvedValue({
      accessToken: makeToken({ sub: '7', perfil: 'admin', imobiliaria_id: '1', iat: 0, exp: 0 }),
      expiresInSeconds: 3600,
    });
    vi.mocked(apiClient.me).mockResolvedValue(null);

    renderApp();

    await waitFor(() => {
      expect(useAppStore.getState().auth.userId).toBe('7');
      expect(useAppStore.getState().role).toBe('admin');
    });
    expect(useAppStore.getState().auth.userName ?? null).toBeNull();
  });

  it('redirects to /login when the refresh cookie is no longer valid', async () => {
    vi.mocked(apiClient.refresh).mockResolvedValue(null);

    const { findByRole } = renderApp(['/dashboard']);

    // Sem sessão, o guard manda para /login — a tela de login renderiza seu heading.
    expect(await findByRole('heading', { name: 'Bem-vindo' })).toBeInTheDocument();
  });
});
