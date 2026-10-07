import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ClienteSolicitar } from '../../../pages/clienteSolicitar/ClienteSolicitar';
import { useAppStore } from '../../../store/useAppStore';
import { ApiError } from '../../../api/client';
import * as clientesB2cApi from '../../../api/clientesB2c';
import * as imoveisApi from '../../../api/imoveis';
import * as solicitacoesApi from '../../../api/solicitacoes';
import * as solicitacaoB2cApi from '../../../api/solicitacaoB2c';
import * as b2cServicosApi from '../../../api/b2cServicos';

vi.mock('../../../api/clientesB2c', () => ({
  useMeuClienteB2c: vi.fn(),
}));

vi.mock('../../../api/imoveis', () => ({
  useCidades: vi.fn(),
  useEnderecoPorCep: vi.fn(),
}));

vi.mock('../../../api/b2cServicos', () => ({
  useB2cServicos: vi.fn(),
}));

const mockB2cServicos = [
  { id: 'vistoria_entrada', nome: 'Vistoria de Entrada', descricao: 'Documenta o imóvel antes de você receber as chaves.', icone: 'key', ativo: true },
  { id: 'vistoria_saida', nome: 'Vistoria de Saída', descricao: 'Registra o estado do imóvel na devolução das chaves.', icone: 'log-out', ativo: true },
];

// `isSemVistoriador` é usado de verdade pelo componente para distinguir o 409 — mantém a
// implementação real e só troca o hook de rede.
vi.mock('../../../api/solicitacoes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/solicitacoes')>();
  return { ...actual, useIntervenientePapeis: vi.fn() };
});

// Idem para `isAoMenosUmIntervenienteObrigatorio`.
vi.mock('../../../api/solicitacaoB2c', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/solicitacaoB2c')>();
  return {
    ...actual,
    useCreateRascunhoB2c: vi.fn(),
    usePatchRascunhoB2c: vi.fn(),
    usePatchIntervenientesB2c: vi.fn(),
    useFinalizarSolicitacaoB2c: vi.fn(),
  };
});

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

const mockCidades = [
  { id: '1', nome: 'Brasília', uf: 'DF' },
  { id: '2', nome: 'São Paulo', uf: 'SP' },
];

const mockPapeis = [
  { slug: 'locatario', nome: 'Locatário' },
  { slug: 'locador', nome: 'Locador' },
];

const meBase = {
  id: 'cli-1', usuarioId: 'u-1', nome: 'Maria Cliente', email: 'maria@example.com',
  cpf: '11144477735', telefone: '', cidadeId: '1',
  clientServices: ['vistoria_entrada', 'vistoria_saida'] as const,
  status: 'ativo', quantidadeVistorias: 0, criadoEm: '2026-01-01T00:00:00Z',
};

const rascunhoResp = {
  solicitacaoId: 'sol-1', servicoId: 'srv-1', status: 'atribuida',
  precoSnapshot: 250, dataAgendada: '2026-12-01T13:00:00Z',
  vistoriadorId: 'v-1', vistoriadorNome: 'João Vistoriador',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/solicitar']}>
        <Routes>
          <Route path="/solicitar" element={<><ClienteSolicitar /><LocationProbe /></>} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ClienteSolicitar (Página 4 — wizard de solicitação do Cliente B2C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ toastMessage: null });

    vi.mocked(clientesB2cApi.useMeuClienteB2c).mockReturnValue({
      data: meBase, isLoading: false, isError: false,
    } as any);
    vi.mocked(imoveisApi.useCidades).mockReturnValue({ data: mockCidades, isLoading: false } as any);
    vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({ data: null, isFetching: false } as any);
    vi.mocked(b2cServicosApi.useB2cServicos).mockReturnValue({ data: mockB2cServicos, isLoading: false } as any);
    vi.mocked(solicitacoesApi.useIntervenientePapeis).mockReturnValue({ data: mockPapeis } as any);

    vi.mocked(solicitacaoB2cApi.useCreateRascunhoB2c).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(rascunhoResp), isPending: false,
    } as any);
    vi.mocked(solicitacaoB2cApi.usePatchRascunhoB2c).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(rascunhoResp), isPending: false,
    } as any);
    vi.mocked(solicitacaoB2cApi.usePatchIntervenientesB2c).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false,
    } as any);
    vi.mocked(solicitacaoB2cApi.useFinalizarSolicitacaoB2c).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(rascunhoResp), isPending: false,
    } as any);
  });

  /** Passo 1 (Endereço) — só o obrigatório: rua. */
  const preencherEndereco = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
  };

  const irParaCaracteristicas = async (user: ReturnType<typeof userEvent.setup>) => {
    await preencherEndereco(user);
    await user.click(screen.getByRole('button', { name: /próximo/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Características do imóvel' })).toBeInTheDocument(),
    );
  };

  /** Passo 2 (Características) — tipo/metragem/data/hora, o mínimo pra avançar. */
  const preencherCaracteristicas = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.selectOptions(screen.getByLabelText('Tipo de imóvel'), 'Apartamento');
    await user.type(screen.getByLabelText('Metragem (m²)'), '75');
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:00' } });
  };

  const irParaServico = async (user: ReturnType<typeof userEvent.setup>) => {
    await irParaCaracteristicas(user);
    await preencherCaracteristicas(user);
    await user.click(screen.getByRole('button', { name: /próximo/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tipo de serviço' })).toBeInTheDocument());
  };

  /** Escolhe "Vistoria de Entrada", "Não" acompanhamento, e avança (dispara POST/PATCH rascunho-b2c). */
  const irParaIntervenientes = async (user: ReturnType<typeof userEvent.setup>) => {
    await irParaServico(user);
    await user.click(screen.getByText('Vistoria de Entrada').closest('[role="radio"]')!);
    await user.click(screen.getByRole('button', { name: /^não$/i }));
    await user.click(screen.getByRole('button', { name: /próximo/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Demais intervenientes' })).toBeInTheDocument());
  };

  const irParaConfirmacao = async (user: ReturnType<typeof userEvent.setup>) => {
    await irParaIntervenientes(user);
    await user.click(screen.getByRole('button', { name: /próximo/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Confirmação' })).toBeInTheDocument());
  };

  describe('Passo 1 (endereço) — CEP fora da cidade do cliente', () => {
    it('blocks "Próximo" (erro no campo, sem avançar) when the CEP resolves to a different city', async () => {
      vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({
        data: { cep: '01310-000', logradouro: 'Av Paulista', complemento: '', localidade: 'São Paulo', uf: 'SP' },
        isFetching: false,
      } as any);

      const user = userEvent.setup();
      renderPage();

      await preencherEndereco(user);
      await user.type(screen.getByLabelText('CEP'), '01310000');

      await waitFor(
        () => expect(screen.getByText(/fora da sua cidade cadastrada/i)).toBeInTheDocument(),
        { timeout: 2000 },
      );

      await user.click(screen.getByRole('button', { name: /próximo/i }));

      // Não avançou — ainda no passo de endereço.
      expect(screen.getByRole('heading', { name: 'Endereço do imóvel' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Características do imóvel' })).not.toBeInTheDocument();
    });

    it('blocks even when the resolved city has no row in the internal cidades catalog', async () => {
      // "Realejo/XX" não existe em mockCidades — a checagem não pode depender de achar
      // uma linha no catálogo geral, só de comparar com a cidade do próprio cliente.
      vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({
        data: { cep: '99999-999', logradouro: 'Rua Sem Nome', complemento: '', localidade: 'Realejo', uf: 'XX' },
        isFetching: false,
      } as any);

      const user = userEvent.setup();
      renderPage();

      await preencherEndereco(user);
      await user.type(screen.getByLabelText('CEP'), '99999999');

      await waitFor(() =>
        expect(screen.getByText(/fora da sua cidade cadastrada/i)).toBeInTheDocument(),
      );
    });

    it('a CEP matching the cliente\'s own city does not block progression, and does not autofill complemento', async () => {
      vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({
        data: { cep: '70714-520', logradouro: 'SQN 210', complemento: 'Bloco A', localidade: 'Brasília', uf: 'DF' },
        isFetching: false,
      } as any);

      const user = userEvent.setup();
      renderPage();

      await preencherEndereco(user);
      await user.type(screen.getByLabelText('CEP'), '70714520');

      await waitFor(
        () => expect((screen.getByLabelText('Rua') as HTMLInputElement).value).toBe('SQN 210'),
        { timeout: 2000 },
      );
      expect(screen.queryByText(/fora da sua cidade cadastrada/i)).not.toBeInTheDocument();
      // Só a rua é preenchida automaticamente — complemento fica em branco mesmo o ViaCEP devolvendo um.
      expect((screen.getByLabelText('Complemento') as HTMLInputElement).value).toBe('');

      await user.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Características do imóvel' })).toBeInTheDocument(),
      );
    });
  });

  describe('Passo 2 (características) — "Dados do imóvel" (select multiseleção)', () => {
    it('só oferece "Cobertura" quando o tipo é Apartamento', async () => {
      const user = userEvent.setup();
      renderPage();
      await irParaCaracteristicas(user);

      const dadosImovel = screen.getByLabelText('Dados do imóvel');
      expect(screen.queryByRole('option', { name: 'Cobertura' })).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Tipo de imóvel'), 'Casa');
      expect(screen.queryByRole('option', { name: 'Cobertura' })).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Tipo de imóvel'), 'Apartamento');
      expect(dadosImovel).toContainElement(screen.getByRole('option', { name: 'Cobertura' }));
    });

    it('selecionar "Tem quarto" no multiselect revela o campo Quantos quartos', async () => {
      const user = userEvent.setup();
      renderPage();
      await irParaCaracteristicas(user);
      await user.selectOptions(screen.getByLabelText('Tipo de imóvel'), 'Apartamento');

      expect(screen.queryByLabelText('Quantos quartos?')).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Dados do imóvel'), ['Tem quarto']);
      expect(screen.getByLabelText('Quantos quartos?')).toBeInTheDocument();
    });

    it('permite selecionar mais de uma opção ao mesmo tempo (mobiliado + tem quarto)', async () => {
      const user = userEvent.setup();
      renderPage();
      await irParaCaracteristicas(user);

      await user.selectOptions(screen.getByLabelText('Dados do imóvel'), ['Mobiliado', 'Tem quarto']);

      const dadosImovel = screen.getByLabelText('Dados do imóvel') as HTMLSelectElement;
      const selecionados = Array.from(dadosImovel.selectedOptions).map((o) => o.text);
      expect(selecionados).toEqual(expect.arrayContaining(['Mobiliado', 'Tem quarto']));
    });

    it('trocar o tipo pra fora de Apartamento derruba a cobertura já selecionada', async () => {
      const user = userEvent.setup();
      renderPage();
      await irParaCaracteristicas(user);
      await user.selectOptions(screen.getByLabelText('Tipo de imóvel'), 'Apartamento');
      await user.selectOptions(screen.getByLabelText('Dados do imóvel'), ['Cobertura']);

      await user.selectOptions(screen.getByLabelText('Tipo de imóvel'), 'Casa');
      expect(screen.queryByRole('option', { name: 'Cobertura' })).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Tipo de imóvel'), 'Apartamento');
      const dadosImovel = screen.getByLabelText('Dados do imóvel') as HTMLSelectElement;
      expect(Array.from(dadosImovel.selectedOptions).map((o) => o.text)).not.toContain('Cobertura');
    });
  });

  describe('Passo 3 (serviço) — cards filtrados por clientServices', () => {
    it('renders only the cards for the clientServices enabled for this cliente', async () => {
      vi.mocked(clientesB2cApi.useMeuClienteB2c).mockReturnValue({
        data: { ...meBase, clientServices: ['vistoria_saida'] },
        isLoading: false, isError: false,
      } as any);

      const user = userEvent.setup();
      renderPage();
      await irParaServico(user);

      expect(screen.getByText('Vistoria de Saída')).toBeInTheDocument();
      expect(screen.queryByText('Vistoria de Entrada')).not.toBeInTheDocument();
      // Único serviço habilitado → pré-selecionado automaticamente (ainda como card único).
      expect(screen.getByText('Vistoria de Saída').closest('[role="radio"]')).toHaveAttribute('aria-checked', 'true');
    });

    it('renders both cards when both client_services are enabled, unselected by default', async () => {
      const user = userEvent.setup();
      renderPage();
      await irParaServico(user);

      expect(screen.getByText('Vistoria de Entrada').closest('[role="radio"]')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByText('Vistoria de Saída').closest('[role="radio"]')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('rascunho-b2c: POST na 1ª vez, PATCH no retry', () => {
    it('calls POST (useCreateRascunhoB2c) the first time and PATCH (usePatchRascunhoB2c) once a solicitacaoId already exists', async () => {
      const mockCreate = vi.fn().mockResolvedValue(rascunhoResp);
      const mockPatch = vi.fn().mockResolvedValue(rascunhoResp);
      vi.mocked(solicitacaoB2cApi.useCreateRascunhoB2c).mockReturnValue({ mutateAsync: mockCreate, isPending: false } as any);
      vi.mocked(solicitacaoB2cApi.usePatchRascunhoB2c).mockReturnValue({ mutateAsync: mockPatch, isPending: false } as any);

      const user = userEvent.setup();
      renderPage();
      await irParaIntervenientes(user);

      await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
      expect(mockPatch).not.toHaveBeenCalled();
      expect(mockCreate.mock.calls[0][0]).toMatchObject({
        b2cServiceId: 'vistoria_entrada',
        imovel: expect.objectContaining({ cidadeId: '1' }),
      });

      // Volta para o passo Serviço e tenta de novo — agora com `solicitacaoId` já setado.
      const voltarButtons = screen.getAllByRole('button', { name: 'Voltar' });
      await user.click(voltarButtons[voltarButtons.length - 1]);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Tipo de serviço' })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockPatch.mock.calls[0][0]).toMatchObject({ id: 'sol-1', b2cServiceId: 'vistoria_entrada' });
      // PATCH não manda `imovel` nem `acompanhante` — só b2cServiceId/dataDesejada.
      expect(mockPatch.mock.calls[0][0]).not.toHaveProperty('imovel');
      expect(mockPatch.mock.calls[0][0]).not.toHaveProperty('acompanhante');
    });
  });

  describe('409 SEM_VISTORIADOR', () => {
    it('sends the user back to Características (onde ficam data/hora) with an inline message instead of a generic toast', async () => {
      const err = new ApiError('conflict', 409, { codigo: 'SEM_VISTORIADOR', servicos: [] });
      const mockCreate = vi.fn().mockRejectedValue(err);
      vi.mocked(solicitacaoB2cApi.useCreateRascunhoB2c).mockReturnValue({ mutateAsync: mockCreate, isPending: false } as any);

      const user = userEvent.setup();
      renderPage();
      await irParaServico(user);

      await user.click(screen.getByText('Vistoria de Entrada').closest('[role="radio"]')!);
      await user.click(screen.getByRole('button', { name: /^não$/i }));
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      await waitFor(() =>
        expect(screen.getByText(/não há vistoriador disponível nesse horário/i)).toBeInTheDocument(),
      );
      expect(screen.getByRole('heading', { name: 'Características do imóvel' })).toBeInTheDocument();
      // Sem toast genérico.
      expect(useAppStore.getState().toastMessage).toBeNull();
    });
  });

  describe('Passo 5 (confirmação) — finalizar', () => {
    it('"Salvar" calls POST .../finalizar and navigates to /solicitacoes/:id/pagar on success', async () => {
      const mockFinalizar = vi.fn().mockResolvedValue(rascunhoResp);
      vi.mocked(solicitacaoB2cApi.useFinalizarSolicitacaoB2c).mockReturnValue({
        mutateAsync: mockFinalizar, isPending: false,
      } as any);

      const user = userEvent.setup();
      renderPage();
      await irParaConfirmacao(user);

      await user.click(screen.getByRole('button', { name: /^salvar$/i }));

      await waitFor(() => expect(mockFinalizar).toHaveBeenCalledWith('sol-1'));
      await waitFor(() => expect(currentPath()).toBe('/solicitacoes/sol-1/pagar'));
    });

    it('a 400 "ao_menos_um_interveniente_obrigatorio" on finalizar sends the user back to the intervenientes step', async () => {
      const err = new ApiError('bad request', 400, { detail: 'ao_menos_um_interveniente_obrigatorio' });
      const mockFinalizar = vi.fn().mockRejectedValue(err);
      vi.mocked(solicitacaoB2cApi.useFinalizarSolicitacaoB2c).mockReturnValue({
        mutateAsync: mockFinalizar, isPending: false,
      } as any);

      const user = userEvent.setup();
      renderPage();
      await irParaConfirmacao(user);

      await user.click(screen.getByRole('button', { name: /^salvar$/i }));

      await waitFor(() =>
        expect(screen.getByText(/é necessário ao menos um interveniente/i)).toBeInTheDocument(),
      );
      expect(screen.getByRole('heading', { name: 'Demais intervenientes' })).toBeInTheDocument();
      expect(currentPath()).toBe('/solicitar');
    });

    it('a 409 SEM_VISTORIADOR on finalizar sends the user back to Características', async () => {
      const err = new ApiError('conflict', 409, { codigo: 'SEM_VISTORIADOR', servicos: [] });
      const mockFinalizar = vi.fn().mockRejectedValue(err);
      vi.mocked(solicitacaoB2cApi.useFinalizarSolicitacaoB2c).mockReturnValue({
        mutateAsync: mockFinalizar, isPending: false,
      } as any);

      const user = userEvent.setup();
      renderPage();
      await irParaConfirmacao(user);

      await user.click(screen.getByRole('button', { name: /^salvar$/i }));

      await waitFor(() =>
        expect(screen.getByText(/não há vistoriador disponível nesse horário/i)).toBeInTheDocument(),
      );
      expect(screen.getByRole('heading', { name: 'Características do imóvel' })).toBeInTheDocument();
    });
  });
});
