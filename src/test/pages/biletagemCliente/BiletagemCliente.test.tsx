import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BiletagemCliente } from '../../../pages/biletagemCliente/BiletagemCliente';
import { useAppStore } from '../../../store/useAppStore';
import * as biletagemClienteApi from '../../../api/biletagemCliente';

vi.mock('../../../api/biletagemCliente', () => ({
  useBiletagemCliente: vi.fn(),
  usePutBiletagemCliente: vi.fn(),
}));

const SERVICOS = [
  { id: 's1', nome: 'Vistoria de Entrada', descricao: '', icone: 'key' },
  { id: 's2', nome: 'Vistoria de Saída', descricao: '', icone: 'log-out' },
];

const emptyConfig = { modo: 'faixa' as const, servicos: SERVICOS, percentuais: [], faixas: [] };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BiletagemCliente />
    </QueryClientProvider>,
  );
}

describe('BiletagemCliente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState((s) => ({ toastMessage: null, auth: { ...s.auth, perfil: 'admin' } }));

    vi.mocked(biletagemClienteApi.useBiletagemCliente).mockReturnValue({
      data: emptyConfig,
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(biletagemClienteApi.usePutBiletagemCliente).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(emptyConfig),
      isPending: false,
    } as any);
  });

  describe('edição restrita a admin', () => {
    it('non-admin sees no lock toggle nor save button, and the type radios are disabled', () => {
      useAppStore.setState((s) => ({ auth: { ...s.auth, perfil: 'suporte' } }));
      renderPage();

      expect(screen.queryByRole('button', { name: /editar valores/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /salvar biletagem/i })).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /faixa de metragem/i })).toBeDisabled();
    });

    it('admin sees "Editar valores" but the save button stays hidden until editing starts', () => {
      renderPage();

      expect(screen.getByRole('radio', { name: /faixa de metragem/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /editar valores/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /salvar biletagem/i })).not.toBeInTheDocument();
    });
  });

  describe('cadeado de valores', () => {
    it('cells stay read-only until "Editar valores" is clicked, then "Cancelar" locks them again', async () => {
      const user = userEvent.setup();
      renderPage();

      expect(screen.getAllByText('—')[0]).toHaveClass('bc-cell-display--readonly');

      await user.click(screen.getByRole('button', { name: /editar valores/i }));
      expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument();
      expect(screen.getAllByText('—')[0]).not.toHaveClass('bc-cell-display--readonly');

      await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
      expect(screen.getByRole('button', { name: /editar valores/i })).toBeInTheDocument();
    });

    it('"Cancelar" discards values typed during the edit session', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /editar valores/i }));
      const [firstCell] = screen.getAllByText('—');
      await user.click(firstCell);
      await user.type(screen.getAllByPlaceholderText('0,00')[0], '150');
      await user.tab();
      expect(screen.getAllByText('R$ 150')[0]).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
      await user.click(screen.getByRole('button', { name: /editar valores/i }));
      expect(screen.queryByText('R$ 150')).not.toBeInTheDocument();
    });

    it('clicking a cell while unlocked opens an input for that value only', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole('button', { name: /editar valores/i }));

      const [firstCell] = screen.getAllByText('—');
      await user.click(firstCell);

      expect(screen.getAllByPlaceholderText('0,00')[0]).toHaveFocus();
    });
  });

  describe('abas de serviço', () => {
    it('renders one tab per servico from the API', () => {
      renderPage();

      expect(screen.getByRole('tab', { name: 'Vistoria de Entrada' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Vistoria de Saída' })).toBeInTheDocument();
    });
  });

  describe('alternância de modo', () => {
    it('starts in "Faixa de metragem" mode (default) showing the faixa grid, not the percentual panel', () => {
      renderPage();

      expect(screen.getByText('0 – 40 m²')).toBeInTheDocument();
      expect(screen.queryByText('Percentual (%)')).not.toBeInTheDocument();
    });

    it('switching mode while locked (no pending edits) does not prompt for confirmation', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('radio', { name: /percentual/i }));

      expect(screen.getByText('Percentual (%)')).toBeInTheDocument();
      expect(screen.queryByText(/trocar tipo de biletagem/i)).not.toBeInTheDocument();
    });

    it('switching mode while unlocked asks for confirmation and keeps the mode if cancelled', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole('button', { name: /editar valores/i }));

      await user.click(screen.getByRole('radio', { name: /percentual/i }));
      expect(screen.getByText(/trocar tipo de biletagem/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /voltar/i }));
      expect(screen.getByText('0 – 40 m²')).toBeInTheDocument();
    });

    it('confirming the switch while unlocked discards the session and re-locks', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole('button', { name: /editar valores/i }));

      await user.click(screen.getByRole('radio', { name: /percentual/i }));
      await user.click(screen.getByRole('button', { name: /trocar e descartar/i }));

      expect(screen.getByText('Percentual (%)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /editar valores/i })).toBeInTheDocument();
    });
  });

  describe('salvar', () => {
    it('the save button only appears once editing is unlocked, and asks for confirmation before saving', async () => {
      const user = userEvent.setup();
      renderPage();

      expect(screen.queryByRole('button', { name: /salvar biletagem/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /editar valores/i }));
      expect(screen.getByRole('button', { name: /salvar biletagem/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /salvar biletagem/i }));
      expect(screen.getByText(/salvar biletagem\?/i)).toBeInTheDocument();
    });

    it('PUTs only the faixa array when in faixa mode (percentuais empty)', async () => {
      const mockPut = vi.fn().mockResolvedValue(emptyConfig);
      vi.mocked(biletagemClienteApi.usePutBiletagemCliente).mockReturnValue({
        mutateAsync: mockPut,
        isPending: false,
      } as any);

      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole('button', { name: /editar valores/i }));
      await user.click(screen.getByRole('button', { name: /salvar biletagem/i }));
      await user.click(screen.getByRole('button', { name: /^salvar$/i }));

      await waitFor(() => expect(mockPut).toHaveBeenCalled());
      const body = mockPut.mock.calls[0][0];
      expect(body.modo).toBe('faixa');
      expect(body.percentuais).toEqual([]);
      // 2 serviços × 5 faixas = 10 linhas no array de faixas.
      expect(body.faixas).toHaveLength(10);
    });

    it('PUTs only the percentuais array when in percentual mode (faixas empty)', async () => {
      const mockPut = vi.fn().mockResolvedValue(emptyConfig);
      vi.mocked(biletagemClienteApi.usePutBiletagemCliente).mockReturnValue({
        mutateAsync: mockPut,
        isPending: false,
      } as any);

      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole('radio', { name: /percentual/i }));
      await user.click(screen.getByRole('button', { name: /editar valores/i }));
      await user.click(screen.getByRole('button', { name: /salvar biletagem/i }));
      await user.click(screen.getByRole('button', { name: /^salvar$/i }));

      await waitFor(() => expect(mockPut).toHaveBeenCalled());
      const body = mockPut.mock.calls[0][0];
      expect(body.modo).toBe('percentual');
      expect(body.faixas).toEqual([]);
      expect(body.percentuais).toHaveLength(2);
    });

    it('cancelling the confirmation popup does not save and keeps editing unlocked', async () => {
      const mockPut = vi.fn().mockResolvedValue(emptyConfig);
      vi.mocked(biletagemClienteApi.usePutBiletagemCliente).mockReturnValue({
        mutateAsync: mockPut,
        isPending: false,
      } as any);

      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole('button', { name: /editar valores/i }));
      await user.click(screen.getByRole('button', { name: /salvar biletagem/i }));
      await user.click(screen.getByRole('button', { name: /voltar/i }));

      expect(mockPut).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument();
    });

    it('shows a success toast after saving and re-locks the values', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole('button', { name: /editar valores/i }));
      await user.click(screen.getByRole('button', { name: /salvar biletagem/i }));
      await user.click(screen.getByRole('button', { name: /^salvar$/i }));

      await waitFor(() => expect(useAppStore.getState().toastMessage).toBe('Biletagem do cliente salva'));
      expect(screen.getByRole('button', { name: /editar valores/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /salvar biletagem/i })).not.toBeInTheDocument();
    });
  });
});
