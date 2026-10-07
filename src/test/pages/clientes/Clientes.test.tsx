import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Clientes } from '../../../pages/clientes/Clientes';
import { useAppStore } from '../../../store/useAppStore';
import * as clientesB2cApi from '../../../api/clientesB2c';
import * as adminApi from '../../../api/admin';
import * as imoveisApi from '../../../api/imoveis';

vi.mock('../../../api/clientesB2c', () => ({
  useClientesB2c: vi.fn(),
  useInativarClienteB2c: vi.fn(),
}));
vi.mock('../../../api/admin', () => ({
  useResendInvite: vi.fn(),
}));
vi.mock('../../../api/imoveis', () => ({
  useCidades: vi.fn(),
}));

const mockCidades = [
  { id: '1', nome: 'Brasília', uf: 'DF' },
  { id: '2', nome: 'São Paulo', uf: 'SP' },
];

const mockClientes = {
  content: [
    {
      id: 'c1', usuarioId: 'u1', nome: 'Ana Convidada', email: 'ana@example.com', cpf: '11144477735',
      telefone: '', cidadeId: '1', clientServices: ['vistoria_entrada'], status: 'convidado',
      quantidadeVistorias: 0, criadoEm: '2026-01-01T00:00:00Z',
    },
    {
      id: 'c2', usuarioId: 'u2', nome: 'Beto Ativo', email: 'beto@example.com', cpf: '22233344409',
      telefone: '', cidadeId: '1', clientServices: ['vistoria_entrada', 'vistoria_saida'], status: 'ativo',
      quantidadeVistorias: 3, criadoEm: '2026-01-02T00:00:00Z',
    },
    {
      id: 'c3', usuarioId: 'u3', nome: 'Carla Inativa', email: 'carla@example.com', cpf: '33344455567',
      telefone: '', cidadeId: '2', clientServices: ['vistoria_saida'], status: 'inativo',
      quantidadeVistorias: 1, criadoEm: '2026-01-03T00:00:00Z',
    },
  ],
  totalElements: 3,
  totalPages: 1,
  size: 20,
  number: 0,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/clientes']}>
        <Clientes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Clientes (listagem B2C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ toastMessage: null });

    vi.mocked(imoveisApi.useCidades).mockReturnValue({ data: mockCidades, isLoading: false } as any);
    vi.mocked(clientesB2cApi.useClientesB2c).mockReturnValue({
      data: mockClientes,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.mocked(clientesB2cApi.useInativarClienteB2c).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
    vi.mocked(adminApi.useResendInvite).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
  });

  it('renders rows from the API (nome/email/qtd. vistorias)', () => {
    renderPage();

    expect(screen.getByText('Ana Convidada')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('Beto Ativo')).toBeInTheDocument();
    expect(screen.getByText('Carla Inativa')).toBeInTheDocument();
  });

  describe('filtros (FilterPopover)', () => {
    const lastCallParams = () =>
      vi.mocked(clientesB2cApi.useClientesB2c).mock.calls.at(-1)?.[0];

    it('debounces the search field into `q`', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /^filtros/i }));
      await user.type(await screen.findByLabelText('Nome ou e-mail'), 'ana');

      await waitFor(() => expect(lastCallParams()).toMatchObject({ q: 'ana' }), { timeout: 2000 });
    });

    it('passes the selected cidade as `cidadeId`', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /^filtros/i }));
      await user.selectOptions(await screen.findByLabelText('Cidade'), '1');

      await waitFor(() => expect(lastCallParams()).toMatchObject({ cidadeId: '1' }));
    });

    it('passes the selected status label back as the status key', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /^filtros/i }));
      await user.selectOptions(await screen.findByLabelText('Status'), 'Ativo');

      await waitFor(() => expect(lastCallParams()).toMatchObject({ status: 'ativo' }));
    });

    it('resets page to 0 when a filter changes', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /^filtros/i }));
      await user.selectOptions(await screen.findByLabelText('Cidade'), '1');

      await waitFor(() => expect(lastCallParams()).toMatchObject({ page: 0 }));
    });
  });

  describe('ActionMenu por status', () => {
    const abrirMenu = async (user: ReturnType<typeof userEvent.setup>, nome: string) => {
      await user.click(screen.getByRole('button', { name: `Ações de ${nome}` }));
    };
    const fecharMenu = async (user: ReturnType<typeof userEvent.setup>, nome: string) => {
      await user.click(screen.getByRole('button', { name: `Ações de ${nome}` }));
    };

    it('shows "Reenviar convite" only when status is convidado', async () => {
      const user = userEvent.setup();
      renderPage();

      await abrirMenu(user, 'Ana Convidada');
      expect(screen.getByRole('menuitem', { name: /reenviar convite/i })).toBeInTheDocument();
      await fecharMenu(user, 'Ana Convidada');

      await abrirMenu(user, 'Beto Ativo');
      expect(screen.queryByRole('menuitem', { name: /reenviar convite/i })).not.toBeInTheDocument();
      await fecharMenu(user, 'Beto Ativo');

      await abrirMenu(user, 'Carla Inativa');
      expect(screen.queryByRole('menuitem', { name: /reenviar convite/i })).not.toBeInTheDocument();
    });

    it('hides "Inativar" only for a row that is already inativo', async () => {
      const user = userEvent.setup();
      renderPage();

      await abrirMenu(user, 'Ana Convidada');
      expect(screen.getByRole('menuitem', { name: /^inativar$/i })).toBeInTheDocument();
      await fecharMenu(user, 'Ana Convidada');

      await abrirMenu(user, 'Beto Ativo');
      expect(screen.getByRole('menuitem', { name: /^inativar$/i })).toBeInTheDocument();
      await fecharMenu(user, 'Beto Ativo');

      await abrirMenu(user, 'Carla Inativa');
      expect(screen.queryByRole('menuitem', { name: /^inativar$/i })).not.toBeInTheDocument();
    });

    it('always offers "Editar" regardless of status', async () => {
      const user = userEvent.setup();
      renderPage();

      await abrirMenu(user, 'Carla Inativa');
      expect(screen.getByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    });
  });

  describe('Reenviar convite', () => {
    it('calls useResendInvite with the row\'s usuarioId (not the cliente id)', async () => {
      const mockResend = vi.fn().mockResolvedValue({});
      vi.mocked(adminApi.useResendInvite).mockReturnValue({ mutateAsync: mockResend, isPending: false } as any);

      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Ações de Ana Convidada' }));
      await user.click(screen.getByRole('menuitem', { name: /reenviar convite/i }));

      await waitFor(() => expect(mockResend).toHaveBeenCalledWith('u1'));
      await waitFor(() =>
        expect(useAppStore.getState().toastMessage).toBe('Convite reenviado para ana@example.com'),
      );
    });
  });

  describe('Inativar', () => {
    it('opens a confirm dialog and only calls useInativarClienteB2c after confirming', async () => {
      const mockInativar = vi.fn().mockResolvedValue({});
      vi.mocked(clientesB2cApi.useInativarClienteB2c).mockReturnValue({
        mutateAsync: mockInativar,
        isPending: false,
      } as any);

      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Ações de Beto Ativo' }));
      await user.click(screen.getByRole('menuitem', { name: /^inativar$/i }));
      expect(mockInativar).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /^inativar$/i }));

      await waitFor(() => expect(mockInativar).toHaveBeenCalledWith('c2'));
      await waitFor(() => expect(useAppStore.getState().toastMessage).toBe('Cliente inativado'));
    });
  });
});
