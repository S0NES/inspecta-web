import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Audit } from '../../../pages/audit/Audit';
import { useAppStore } from '../../../store/useAppStore';
import * as contestacoesApi from '../../../api/contestacoes';

vi.mock('../../../api/contestacoes', () => ({
  useContestacoes: vi.fn(),
  useResolverContestacao: vi.fn(),
}));

const mockContestacoes = {
  content: [
    {
      id: '1',
      laudoId: '1042',
      nodeUuid: 'a1b2c3d4-0000-0000-0000-000000000001',
      autorId: '7',
      texto: 'Falta foto do piso da sala',
      status: 'aberta' as const,
      resolucao: null,
      criadoEm: '2026-08-15T10:00:00Z',
    },
    {
      id: '2',
      laudoId: '1041',
      nodeUuid: 'a1b2c3d4-0000-0000-0000-000000000002',
      autorId: '8',
      texto: 'Cobertura sem foto do telhado',
      status: 'aceita' as const,
      resolucao: 'Foto reenviada e aprovada',
      criadoEm: '2026-08-14T10:00:00Z',
    },
  ],
  totalElements: 2,
  totalPages: 1,
  size: 50,
  number: 0,
};

const resolverMutateAsync = vi.fn();

function renderWithProviders() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Audit />
    </QueryClientProvider>
  );
}

describe('Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      auth: {
        accessToken: 'token',
        userEmail: 'admin@example.com',
        userId: '1',
        perfil: 'admin',
        imobiliariaId: null,
        loginError: null,
      },
    });

    vi.mocked(contestacoesApi.useContestacoes).mockReturnValue({
      data: mockContestacoes,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(contestacoesApi.useResolverContestacao).mockReturnValue({
      mutateAsync: resolverMutateAsync,
      isPending: false,
    } as any);
  });

  it('renders page header with title and subtitle', () => {
    renderWithProviders();

    expect(screen.getByText('Contestações de laudos')).toBeInTheDocument();
  });

  it('renders table header columns', () => {
    renderWithProviders();

    expect(screen.getByText('LAUDO')).toBeInTheDocument();
    expect(screen.getByText('AUTOR')).toBeInTheDocument();
    expect(screen.getByText('ABERTA EM')).toBeInTheDocument();
    expect(screen.getByText('STATUS')).toBeInTheDocument();
  });

  it('displays real contestações from the API, not fabricated scores', () => {
    renderWithProviders();

    expect(screen.getByText('Laudo #1042')).toBeInTheDocument();
    expect(screen.getByText('Laudo #1041')).toBeInTheDocument();
    expect(screen.queryByText('NOTA')).not.toBeInTheDocument();
    expect(screen.queryByText('COBERTURA')).not.toBeInTheDocument();
  });

  it('displays status badges', () => {
    renderWithProviders();

    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.getByText('Aceita')).toBeInTheDocument();
  });

  it('expands details on row click and shows the contestação text', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByText('Laudo #1042').closest('.audit-row')!);

    expect(screen.getByText('Falta foto do piso da sala')).toBeInTheDocument();
  });

  it('shows the resolução when already resolved', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByText('Laudo #1041').closest('.audit-row')!);

    expect(screen.getByText('Foto reenviada e aprovada')).toBeInTheDocument();
  });

  it('shows Aceitar/Rejeitar actions for admin on an open contestação', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByText('Laudo #1042').closest('.audit-row')!);

    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument();
  });

  it('does not show resolve actions for an already-resolved contestação', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByText('Laudo #1041').closest('.audit-row')!);

    expect(screen.queryByRole('button', { name: 'Aceitar' })).not.toBeInTheDocument();
  });

  it('does not show resolve actions for roles without permission', async () => {
    useAppStore.setState({
      auth: {
        accessToken: 'token',
        userEmail: 'vistoriador@example.com',
        userId: '2',
        perfil: 'vistoriador',
        imobiliariaId: null,
        loginError: null,
      },
    });
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByText('Laudo #1042').closest('.audit-row')!);

    expect(screen.queryByRole('button', { name: 'Aceitar' })).not.toBeInTheDocument();
  });

  it('requires a resolução before accepting', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByText('Laudo #1042').closest('.audit-row')!);
    await user.click(screen.getByRole('button', { name: 'Aceitar' }));

    expect(resolverMutateAsync).not.toHaveBeenCalled();
    expect(useAppStore.getState().toastMessage).toMatch(/resolução/i);
  });

  it('calls the resolver mutation with aceitar=true when accepting', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByText('Laudo #1042').closest('.audit-row')!);
    await user.type(screen.getByPlaceholderText(/descreva a resolução/i), 'Foto reenviada');
    await user.click(screen.getByRole('button', { name: 'Aceitar' }));

    await waitFor(() => {
      expect(resolverMutateAsync).toHaveBeenCalledWith({ id: '1', aceitar: true, resolucao: 'Foto reenviada' });
    });
  });

  it('calls the resolver mutation with aceitar=false when rejecting', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByText('Laudo #1042').closest('.audit-row')!);
    await user.type(screen.getByPlaceholderText(/descreva a resolução/i), 'Não procede');
    await user.click(screen.getByRole('button', { name: 'Rejeitar' }));

    await waitFor(() => {
      expect(resolverMutateAsync).toHaveBeenCalledWith({ id: '1', aceitar: false, resolucao: 'Não procede' });
    });
  });

  it('collapses details when the row is clicked again', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const row = screen.getByText('Laudo #1042').closest('.audit-row')!;
    await user.click(row);
    expect(screen.getByText('Falta foto do piso da sala')).toBeInTheDocument();

    await user.click(row);
    expect(screen.queryByText('Falta foto do piso da sala')).not.toBeInTheDocument();
  });

  it('shows a loading state', () => {
    vi.mocked(contestacoesApi.useContestacoes).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderWithProviders();

    expect(screen.getByText('Carregando contestações...')).toBeInTheDocument();
  });

  it('shows an error state without fabricating data', () => {
    vi.mocked(contestacoesApi.useContestacoes).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API Error'),
    } as any);

    renderWithProviders();

    expect(screen.getByText(/Erro ao carregar contestações/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no contestações', () => {
    vi.mocked(contestacoesApi.useContestacoes).mockReturnValue({
      data: { content: [], totalElements: 0, totalPages: 0, size: 50, number: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders();

    expect(screen.getByText('Nenhuma contestação registrada.')).toBeInTheDocument();
  });
});
