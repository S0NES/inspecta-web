import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ClienteWizard } from '../../../pages/clienteWizard/ClienteWizard';
import { useAppStore } from '../../../store/useAppStore';
import * as clientesB2cApi from '../../../api/clientesB2c';
import * as imoveisApi from '../../../api/imoveis';
import * as b2cServicosApi from '../../../api/b2cServicos';

// `ClienteWizard` guarda o passo em `useAppStore.clienteWizardStep`, mas reseta para 0
// tanto na montagem quanto no desmonte (`useEffect(() => { setStep(0); return () =>
// setStep(0); }, [])`) — por isso os testes SEMPRE navegam pelos cliques reais em vez
// de pré-semear o passo no store antes de renderizar (isso seria sobrescrito no mount).
vi.mock('../../../api/clientesB2c', () => ({
  useCreateClienteB2c: vi.fn(),
  usePatchClienteB2c: vi.fn(),
  useClienteB2c: vi.fn(),
}));

vi.mock('../../../api/imoveis', () => ({
  useCidades: vi.fn(),
}));

vi.mock('../../../api/b2cServicos', () => ({
  useB2cServicos: vi.fn(),
}));

const mockB2cServicos = [
  { id: 'vistoria_entrada', nome: 'Vistoria de Entrada', descricao: 'Documenta o imóvel antes de você receber as chaves.', icone: 'key', ativo: true },
  { id: 'vistoria_saida', nome: 'Vistoria de Saída', descricao: 'Registra o estado do imóvel na devolução das chaves.', icone: 'log-out', ativo: true },
];

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

const mockCidades = [
  { id: '1', nome: 'Brasília', uf: 'DF' },
  { id: '2', nome: 'São Paulo', uf: 'SP' },
];

// CPF com dígitos verificadores válidos (mod-11) — necessário porque o submit chama
// `normalizeCpf`, que lança se o CPF não passar no checksum.
const CPF_VALIDO_DIGITOS = '11144477735';

describe('ClienteWizard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({ clienteWizardStep: 0, toastMessage: null });

    vi.mocked(imoveisApi.useCidades).mockReturnValue({ data: mockCidades, isLoading: false } as any);
    vi.mocked(b2cServicosApi.useB2cServicos).mockReturnValue({ data: mockB2cServicos, isLoading: false } as any);
    vi.mocked(clientesB2cApi.useCreateClienteB2c).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
    vi.mocked(clientesB2cApi.usePatchClienteB2c).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
    vi.mocked(clientesB2cApi.useClienteB2c).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);
  });

  const renderComponent = (editId?: string) => renderAt(editId ? `/clientes/${editId}/edit` : '/clientes/new');
  const renderAt = (entry: string) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/clientes', entry]} initialIndex={1}>
          <Routes>
            <Route path="/clientes/new" element={<><ClienteWizard /><LocationProbe /></>} />
            <Route path="/clientes/:id/edit" element={<><ClienteWizard /><LocationProbe /></>} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const preencherDadosValidos = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Nome completo'), 'Maria da Silva');
    await user.selectOptions(screen.getByLabelText('Cidade'), '1');
    await user.type(screen.getByLabelText('E-mail'), 'maria@example.com');
    await user.type(screen.getByLabelText('CPF'), CPF_VALIDO_DIGITOS);
  };

  /** Preenche o passo Dados e avança para o passo Serviço (modo criação). */
  const irParaServico = async (user: ReturnType<typeof userEvent.setup>) => {
    await preencherDadosValidos(user);
    await user.click(screen.getByRole('button', { name: /próximo/i }));
    await waitFor(() => expect(useAppStore.getState().clienteWizardStep).toBe(1));
  };

  describe('navegação entre passos', () => {
    it('renders the 3 step labels', () => {
      renderComponent();
      expect(screen.getByText('Dados')).toBeInTheDocument();
      expect(screen.getByText('Serviço')).toBeInTheDocument();
      expect(screen.getByText('Confirmação')).toBeInTheDocument();
    });

    it('advances Dados → Serviço → Confirmação with valid data and a selected service', async () => {
      const user = userEvent.setup();
      renderComponent();

      await irParaServico(user);
      expect(screen.getByText('Serviços habilitados')).toBeInTheDocument();

      await user.click(screen.getByText('Vistoria de Entrada').closest('[role="checkbox"]')!);
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() => expect(useAppStore.getState().clienteWizardStep).toBe(2));
      expect(screen.getByText('Confirme os dados')).toBeInTheDocument();
    });

    it('the "Voltar" footer button returns to the previous step', async () => {
      const user = userEvent.setup();
      renderComponent();

      await irParaServico(user);

      const prevButtons = screen.getAllByRole('button', { name: 'Voltar' });
      await user.click(prevButtons[prevButtons.length - 1]);

      await waitFor(() => expect(useAppStore.getState().clienteWizardStep).toBe(0));
    });
  });

  describe('validação de campos (bloqueia "Próximo")', () => {
    it('blocks advancing from step 1 with every required field empty', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await waitFor(() =>
        expect(useAppStore.getState().toastMessage).toBe('Preencha todos os campos obrigatórios'),
      );
      expect(useAppStore.getState().clienteWizardStep).toBe(0);
    });

    it('blocks advancing with an invalid phone format', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.type(screen.getByLabelText('Nome completo'), 'Maria da Silva');
      await user.selectOptions(screen.getByLabelText('Cidade'), '1');
      await user.type(screen.getByLabelText('Telefone'), '123');
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await waitFor(() => expect(useAppStore.getState().toastMessage).toBe('Telefone inválido'));
      expect(useAppStore.getState().clienteWizardStep).toBe(0);
    });

    it('blocks advancing with an invalid e-mail format', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.type(screen.getByLabelText('Nome completo'), 'Maria da Silva');
      await user.selectOptions(screen.getByLabelText('Cidade'), '1');
      await user.type(screen.getByLabelText('E-mail'), 'nao-e-um-email');
      await user.type(screen.getByLabelText('CPF'), CPF_VALIDO_DIGITOS);
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await waitFor(() => expect(useAppStore.getState().toastMessage).toBe('E-mail inválido'));
      expect(useAppStore.getState().clienteWizardStep).toBe(0);
    });

    it('blocks advancing with an invalid CPF (fails checksum)', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.type(screen.getByLabelText('Nome completo'), 'Maria da Silva');
      await user.selectOptions(screen.getByLabelText('Cidade'), '1');
      await user.type(screen.getByLabelText('E-mail'), 'maria@example.com');
      await user.type(screen.getByLabelText('CPF'), '11111111111');
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await waitFor(() => expect(useAppStore.getState().toastMessage).toBe('CPF inválido'));
      expect(useAppStore.getState().clienteWizardStep).toBe(0);
    });

    it('blocks advancing from step 2 (Serviço) with no client_service selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      await irParaServico(user);
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await waitFor(() =>
        expect(useAppStore.getState().toastMessage).toBe('Selecione ao menos um serviço'),
      );
      expect(useAppStore.getState().clienteWizardStep).toBe(1);
    });
  });

  describe('seleção múltipla de client_service (passo Serviço)', () => {
    it('renders both b2c_service cards, unselected by default', async () => {
      const user = userEvent.setup();
      renderComponent();
      await irParaServico(user);

      const entrada = screen.getByText('Vistoria de Entrada').closest('[role="checkbox"]');
      const saida = screen.getByText('Vistoria de Saída').closest('[role="checkbox"]');
      expect(entrada).toHaveAttribute('aria-checked', 'false');
      expect(saida).toHaveAttribute('aria-checked', 'false');
    });

    it('allows selecting both cards independently (multi-select)', async () => {
      const user = userEvent.setup();
      renderComponent();
      await irParaServico(user);

      const entrada = screen.getByText('Vistoria de Entrada').closest('[role="checkbox"]')!;
      const saida = screen.getByText('Vistoria de Saída').closest('[role="checkbox"]')!;

      await user.click(entrada);
      expect(entrada).toHaveAttribute('aria-checked', 'true');
      expect(saida).toHaveAttribute('aria-checked', 'false');

      await user.click(saida);
      expect(entrada).toHaveAttribute('aria-checked', 'true');
      expect(saida).toHaveAttribute('aria-checked', 'true');
    });

    it('toggles a card off when clicked again', async () => {
      const user = userEvent.setup();
      renderComponent();
      await irParaServico(user);

      const entrada = screen.getByText('Vistoria de Entrada').closest('[role="checkbox"]')!;
      await user.click(entrada);
      await user.click(entrada);
      expect(entrada).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('submit (modo criação)', () => {
    it('submits after filling every step in order, calling the create API and navigating to /clientes', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(clientesB2cApi.useCreateClienteB2c).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);

      const user = userEvent.setup();
      renderComponent();

      await preencherDadosValidos(user);
      await user.type(screen.getByLabelText('Telefone'), '61999998888');
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await user.click(await screen.findByText('Vistoria de Entrada'));
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await user.click(await screen.findByRole('button', { name: /criar cliente e enviar convite/i }));

      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
      expect(mockMutateAsync.mock.calls[0][0]).toMatchObject({
        nome: 'Maria da Silva',
        email: 'maria@example.com',
        cidadeId: '1',
        clientServices: ['vistoria_entrada'],
      });

      await waitFor(() => expect(currentPath()).toBe('/clientes'));
    });
  });

  describe('modo edição (rota /clientes/:id/edit)', () => {
    const clienteExistente = {
      id: '42',
      usuarioId: 'u-42',
      nome: 'João Antigo',
      email: 'joao@example.com',
      cpf: '11144477735',
      telefone: '61988887777',
      cidadeId: '1',
      clientServices: ['vistoria_entrada'],
      status: 'ativo',
      quantidadeVistorias: 3,
      criadoEm: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      vi.mocked(clientesB2cApi.useClienteB2c).mockReturnValue({
        data: clienteExistente,
        isLoading: false,
        isError: false,
      } as any);
    });

    /** Passos Dados/Serviço já vêm hidratados válidos do GET — só clicar "Próximo" 2x. */
    const irParaConfirmacaoEdicao = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() => expect(useAppStore.getState().clienteWizardStep).toBe(1));
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() => expect(useAppStore.getState().clienteWizardStep).toBe(2));
    };

    it('renders e-mail and CPF as read-only (immutable identity fields)', () => {
      renderComponent('42');

      expect(screen.getByLabelText('E-mail')).toBeDisabled();
      expect(screen.getByLabelText('CPF')).toBeDisabled();
      expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('joao@example.com');
    });

    it('shows "Salvar alterações" instead of "Criar cliente e enviar convite" on the confirmation step', async () => {
      const user = userEvent.setup();
      renderComponent('42');

      await irParaConfirmacaoEdicao(user);

      expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /criar cliente e enviar convite/i })).not.toBeInTheDocument();
    });

    it('saves via PATCH (not the create/invite API) and navigates to /clientes', async () => {
      const mockPatchAsync = vi.fn().mockResolvedValue({});
      const mockCreateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(clientesB2cApi.usePatchClienteB2c).mockReturnValue({
        mutateAsync: mockPatchAsync,
        isPending: false,
      } as any);
      vi.mocked(clientesB2cApi.useCreateClienteB2c).mockReturnValue({
        mutateAsync: mockCreateAsync,
        isPending: false,
      } as any);

      const user = userEvent.setup();
      renderComponent('42');

      // O PATCH só sai com algo mudado em relação ao snapshot hidratado (ver comentário
      // "manda só o que mudou" no componente) — sem isso `patch` fica vazio e a mutation
      // nem é chamada.
      await user.type(screen.getByLabelText('Nome completo'), ' Editado');

      await irParaConfirmacaoEdicao(user);
      await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

      await waitFor(() => expect(mockPatchAsync).toHaveBeenCalled());
      expect(mockPatchAsync.mock.calls[0][0]).toMatchObject({ id: '42', nome: 'João Antigo Editado' });
      // Sem convite: editar nunca chama a API de criação (a única que dispara e-mail).
      expect(mockCreateAsync).not.toHaveBeenCalled();

      await waitFor(() => expect(currentPath()).toBe('/clientes'));
    });
  });
});
