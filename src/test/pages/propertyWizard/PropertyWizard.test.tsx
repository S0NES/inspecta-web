import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { PropertyWizard } from '../../../pages/propertyWizard/PropertyWizard';
import { useAppStore } from '../../../store/useAppStore';
import * as imoveisApi from '../../../api/imoveis';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} data-search={loc.search} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');
const currentSearch = () => screen.getByTestId('loc').getAttribute('data-search') ?? '';

// Mock the imoveis API hooks
vi.mock('../../../api/imoveis', () => ({
  useCreateImovel: vi.fn(),
  usePatchImovel: vi.fn(),
  useImovel: vi.fn(),
  useCidades: vi.fn(),
  useLogradourosViaCep: vi.fn(),
  useEnderecoPorCep: vi.fn(),
}));

const mockCities = [
  { id: '1', nome: 'Brasília', uf: 'DF' },
  { id: '2', nome: 'São Paulo', uf: 'SP' },
  { id: '3', nome: 'Florianópolis', uf: 'SC' },
];

describe('PropertyWizard Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useAppStore.setState({
      propertyWizardStep: 0,
      toastMessage: null,
    });

    vi.mocked(imoveisApi.useCidades).mockReturnValue({
      data: mockCities,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);

    vi.mocked(imoveisApi.usePatchImovel).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);

    vi.mocked(imoveisApi.useImovel).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(imoveisApi.useLogradourosViaCep).mockReturnValue({
      data: [],
      isFetching: false,
    } as any);

    vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({
      data: null,
      isFetching: false,
    } as any);
  });

  /** id definido → modo edição sob `/properties/:id/edit`; senão `/properties/new`. */
  const renderComponent = (editId?: string) =>
    renderAt(editId ? `/properties/${editId}/edit` : '/properties/new');

  const renderAt = (entry: string) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/properties', entry]} initialIndex={1}>
          <Routes>
            <Route path="/properties/new" element={<><PropertyWizard /><LocationProbe /></>} />
            <Route path="/properties/:id/edit" element={<><PropertyWizard /><LocationProbe /></>} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should render step indicators', () => {
    renderComponent();

    expect(screen.getByText('Endereço')).toBeInTheDocument();
    expect(screen.getByText('Características')).toBeInTheDocument();
    expect(screen.getByText('Confirmação')).toBeInTheDocument();
  });

  it('should render step numbers', () => {
    renderComponent();

    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  it('should render step 1 content (address)', () => {
    renderComponent();

    expect(screen.getByText('Endereço do imóvel')).toBeInTheDocument();
    expect(screen.getByText('Forneça o local exato do imóvel')).toBeInTheDocument();
  });

  it('should render address input on step 1', () => {
    renderComponent();

    expect(screen.getByLabelText('Rua')).toBeInTheDocument();
    expect(screen.getByLabelText('Número')).toBeInTheDocument();
    expect(screen.getByLabelText('CEP')).toBeInTheDocument();
  });

  it('should render city as a read-only field filled by CEP', () => {
    renderComponent();

    const city = screen.getByLabelText('Cidade') as HTMLInputElement;
    expect(city).toBeInTheDocument();
    expect(city.readOnly).toBe(true);
  });

  it('should render previous button disabled on step 1', () => {
    renderComponent();

    // [0] é o "Voltar" do topo (BackButton); [1] é o "Voltar" de etapa no rodapé.
    const prevButton = screen.getAllByRole('button', { name: 'Voltar' })[1];
    expect(prevButton).toBeDisabled();
  });

  it('should render next button enabled on step 1', () => {
    renderComponent();

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    expect(nextButton).not.toBeDisabled();
  });

  it('should update address input', async () => {
    const user = userEvent.setup();
    renderComponent();

    const addressInput = screen.getByPlaceholderText('Ex: Rua das Flores') as HTMLInputElement;
    await user.type(addressInput, 'Rua das Flores');

    expect(addressInput.value).toBe('Rua das Flores');
  });

  it('should show validation error when advancing without required fields', async () => {
    const user = userEvent.setup();
    renderComponent();

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe(
        'Por favor, preencha endereço e cidade'
      );
    });
  });

  it('should navigate to step 2 when required fields are filled via CEP', async () => {
    vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({
      data: {
        cep: '70714-520',
        logradouro: 'Rua das Flores',
        complemento: '',
        localidade: 'Brasília',
        uf: 'DF',
      },
      isFetching: false,
    } as any);
    const user = userEvent.setup();
    renderComponent();

    await user.type(screen.getByLabelText('CEP'), '70714520');
    await waitFor(() => {
      expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('Brasília/DF');
    });

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(useAppStore.getState().propertyWizardStep).toBe(1);
    });
  });

  it('should render step 2 content (characteristics)', () => {
    useAppStore.setState({ propertyWizardStep: 1 });

    renderComponent();

    expect(screen.getByText('Características do imóvel')).toBeInTheDocument();
    expect(screen.getByText('Descreva o imóvel em detalhes')).toBeInTheDocument();
  });

  it('should render property type select on step 2', () => {
    useAppStore.setState({ propertyWizardStep: 1 });

    renderComponent();

    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
  });

  it('should render metragem input on step 2', () => {
    useAppStore.setState({ propertyWizardStep: 1 });

    renderComponent();

    expect(screen.getByLabelText('Metragem (m²)')).toBeInTheDocument();
  });

  it('step 2 shows clickable chips for cobertura and quarto', () => {
    useAppStore.setState({ propertyWizardStep: 1 });
    renderComponent();

    expect(screen.getByRole('button', { name: /^cobertura$/i })).toHaveAttribute('aria-pressed', 'false');
    const quarto = screen.getByRole('button', { name: /^quarto$/i });
    expect(quarto).toHaveAttribute('aria-pressed', 'false');
    expect(quarto).not.toHaveAttribute('aria-controls');
    expect(screen.queryByLabelText('Quantos')).not.toBeInTheDocument();
  });

  it('toggles cobertura chip when clicked', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ propertyWizardStep: 1 });
    renderComponent();

    const chip = screen.getByRole('button', { name: /^cobertura$/i });
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the Quantos field only after clicking the quarto chip', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ propertyWizardStep: 1 });
    renderComponent();

    expect(screen.queryByLabelText('Quantos')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^quarto$/i }));
    expect(screen.getByRole('button', { name: /^quarto$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^quarto$/i })).toHaveAttribute('aria-controls', 'pw-quartos-quantos');
    expect(screen.getByLabelText('Quantos')).toBeInTheDocument();
  });

  it('hides Quantos and clears the count when the quarto chip is turned off', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ propertyWizardStep: 1 });
    renderComponent();

    await user.click(screen.getByRole('button', { name: /^quarto$/i }));
    await user.type(screen.getByLabelText('Quantos'), '3');
    await user.click(screen.getByRole('button', { name: /^quarto$/i }));

    expect(screen.queryByLabelText('Quantos')).not.toBeInTheDocument();
  });

  it('does not render aluguel / mobiliado / Pleno controls on step 2 (hidden this iteration)', () => {
    useAppStore.setState({ propertyWizardStep: 1 });

    renderComponent();

    expect(screen.queryByText('Mobiliado')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Valor do aluguel (R$)')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('should update metragem field on step 2', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ propertyWizardStep: 1 });

    renderComponent();

    const metragemInput = screen.getByPlaceholderText('Ex: 120') as HTMLInputElement;
    await user.type(metragemInput, '120');

    expect(metragemInput.value).toBe('120');
  });

  it('blocks advancing from step 2 when quarto is selected without Quantos', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ propertyWizardStep: 1 });
    renderComponent();

    await user.selectOptions(screen.getByLabelText('Tipo'), 'Apartamento');
    await user.type(screen.getByLabelText('Metragem (m²)'), '80');
    await user.click(screen.getByRole('button', { name: /^quarto$/i }));
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe('Informe quantos quartos');
    });
  });

  it('should validate required fields on step 2', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ propertyWizardStep: 1 });

    renderComponent();

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe(
        'Por favor, preencha todos os campos'
      );
    });
  });

  it('should render step 3 content (confirmation)', () => {
    useAppStore.setState({ propertyWizardStep: 2 });

    renderComponent();

    expect(screen.getByText('Confirme os dados')).toBeInTheDocument();
    expect(screen.getByText('Revise as informações antes de cadastrar')).toBeInTheDocument();
  });

  it('should render save button on step 3', () => {
    useAppStore.setState({ propertyWizardStep: 2 });

    renderComponent();

    expect(screen.getByRole('button', { name: /salvar imóvel/i })).toBeInTheDocument();
  });

  it('should submit form with the real Imovel payload shape', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    useAppStore.setState({ propertyWizardStep: 2 });

    renderComponent();

    const submitButton = screen.getByRole('button', { name: /salvar imóvel/i });
    await userEvent.setup().click(submitButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    const payload = mockMutateAsync.mock.calls[0][0];
    expect(payload).not.toHaveProperty('dormitorios');
    expect(payload).not.toHaveProperty('banheiros');
    expect(payload).not.toHaveProperty('tipoAcesso');
    // Campos ocultos nesta iteração ainda vão no payload, com o default seguro.
    expect(payload.mobiliado).toBe(false);
    expect(payload.valorAluguel).toBeNull();
    expect(payload).not.toHaveProperty('plenoIdExterno');
    // Novos campos de endereço.
    expect(payload).toHaveProperty('numero');
    expect(payload).toHaveProperty('complemento');
    expect(payload.cobertura).toBe(false);
    expect(payload.quartos).toBeNull();
  });

  it('submits quartos and cobertura when the step-2 chips are used', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
    const user = userEvent.setup();
    useAppStore.setState({ propertyWizardStep: 1 });
    renderComponent();

    await user.click(screen.getByRole('button', { name: /^cobertura$/i }));
    await user.click(screen.getByRole('button', { name: /^quarto$/i }));
    await user.type(screen.getByLabelText('Quantos'), '3');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'Apartamento');
    await user.type(screen.getByLabelText('Metragem (m²)'), '80');
    await user.click(screen.getByRole('button', { name: /próximo/i }));

    await user.click(await screen.findByRole('button', { name: /salvar imóvel/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(mockMutateAsync.mock.calls[0][0]).toMatchObject({
      cobertura: true,
      quartos: 3,
    });
  });

  it('should navigate back to step 1', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ propertyWizardStep: 1 });

    renderComponent();

    const prevButton = screen.getAllByRole('button', { name: 'Voltar' })[1];
    await user.click(prevButton);

    await waitFor(() => {
      expect(useAppStore.getState().propertyWizardStep).toBe(0);
    });
  });

  it('should show pending state on submit button', () => {
    vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as any);

    useAppStore.setState({ propertyWizardStep: 2 });

    renderComponent();

    expect(screen.getByRole('button', { name: /salvando/i })).toBeInTheDocument();
  });

  it('should disable submit button while pending', () => {
    vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as any);

    useAppStore.setState({ propertyWizardStep: 2 });

    renderComponent();

    const saveButton = screen.getByRole('button', { name: /salvando/i });
    expect(saveButton).toBeDisabled();
  });

  it('should handle API error on submission', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue(new Error('API Error'));
    vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    useAppStore.setState({ propertyWizardStep: 2 });

    renderComponent();

    const submitButton = screen.getByRole('button', { name: /salvar imóvel/i });
    await userEvent.setup().click(submitButton);

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe('Erro ao cadastrar imóvel. Tente novamente.');
    });
  });

  it('should have correct CSS structure for wizard layout', () => {
    const { container } = renderComponent();

    expect(container.querySelector('.property-wizard-layout')).toBeInTheDocument();
    expect(container.querySelector('.pw-steps')).toBeInTheDocument();
  });

  it('should mark completed steps visually', () => {
    useAppStore.setState({ propertyWizardStep: 2 });

    const { container } = renderComponent();

    const doneSteps = container.querySelectorAll('.pw-step--done');
    expect(doneSteps.length).toBeGreaterThan(0);
  });

  it('should mark current step visually', () => {
    useAppStore.setState({ propertyWizardStep: 1 });

    const { container } = renderComponent();

    const activeSteps = container.querySelectorAll('.pw-step--active');
    expect(activeSteps.length).toBe(1);
  });

  describe('edit mode (route /properties/:id/edit)', () => {
    const mockImovelEdicao = {
      id: '42',
      endereco: 'Rua Antiga',
      numero: '10',
      complemento: 'Fundos',
      cep: '01310-000',
      cidadeId: '1',
      imobiliariaId: '5',
      tipo: 'Casa',
      metragem: 80,
      valorAluguel: 2500,
      mobiliado: true,
      ativo: true,
    };

    beforeEach(() => {
      vi.mocked(imoveisApi.useImovel).mockReturnValue({
        data: mockImovelEdicao,
        isLoading: false,
        error: null,
      } as any);
    });

    it('shows a loading state while the property being edited has not arrived yet', () => {
      vi.mocked(imoveisApi.useImovel).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      } as any);
      renderComponent('42');

      expect(screen.getByText('Carregando imóvel…')).toBeInTheDocument();
    });

    it('pre-fills the address fields (rua, número, complemento, CEP) from the fetched imóvel', () => {
      renderComponent('42');

      expect(screen.getByLabelText('Rua')).toHaveValue('Rua Antiga');
      expect(screen.getByLabelText('Número')).toHaveValue('10');
      expect(screen.getByLabelText('Complemento (opcional)')).toHaveValue('Fundos');
      expect(screen.getByLabelText('CEP')).toHaveValue('01310-000');
    });

    it('pre-fills the characteristics (tipo, metragem) from the fetched imóvel', () => {
      useAppStore.setState({ propertyWizardStep: 1 });

      renderComponent('42');

      expect(screen.getByLabelText('Metragem (m²)')).toHaveValue(80);
    });

    it('pre-fills cobertura and quarto chips from the fetched imóvel', () => {
      vi.mocked(imoveisApi.useImovel).mockReturnValue({
        data: { ...mockImovelEdicao, quartos: 2, cobertura: true },
        isLoading: false,
        error: null,
      } as any);
      useAppStore.setState({ propertyWizardStep: 1 });

      renderComponent('42');

      expect(screen.getByRole('button', { name: /^cobertura$/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /^quarto$/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Quantos')).toHaveValue(2);
    });

    it('shows "Salvar alterações" instead of "Salvar imóvel" on the confirmation step', () => {
      useAppStore.setState({ propertyWizardStep: 2 });

      renderComponent('42');

      expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^salvar imóvel$/i })).not.toBeInTheDocument();
    });

    it('submits a PATCH with the changed fields and returns to /properties on success', async () => {
      const mockPatchAsync = vi.fn().mockResolvedValue({});
      vi.mocked(imoveisApi.usePatchImovel).mockReturnValue({
        mutateAsync: mockPatchAsync,
        isPending: false,
      } as any);

      useAppStore.setState({ propertyWizardStep: 2 });

      renderComponent('42');

      const submitButton = screen.getByRole('button', { name: /salvar alterações/i });
      await userEvent.setup().click(submitButton);

      await waitFor(() => expect(mockPatchAsync).toHaveBeenCalled());
      expect(mockPatchAsync.mock.calls[0][0]).toMatchObject({ id: '42' });

      await waitFor(() => {
        expect(currentPath()).toBe('/properties');
      });
    });

    it('the top "Voltar" link returns to the previous page', async () => {
      useAppStore.setState({ propertyWizardStep: 1 });

      renderComponent('42');

      await userEvent.setup().click(screen.getAllByRole('button', { name: 'Voltar' })[0]);

      expect(currentPath()).toBe('/properties');
    });
  });

  describe('atalho do wizard de solicitação (?imobiliariaId & returnTo)', () => {
    it('cria sem returnTo → volta para /properties', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue({ id: '99' });
      vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);
      useAppStore.setState({ propertyWizardStep: 2 });

      renderAt('/properties/new');

      await userEvent.setup().click(screen.getByRole('button', { name: /salvar imóvel/i }));

      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
      await waitFor(() => expect(currentPath()).toBe('/properties'));
    });

    it('cria com returnTo → volta ao wizard com ?createdImovelId e manda imobiliariaId no POST', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue({ id: '99' });
      vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);
      useAppStore.setState({ propertyWizardStep: 2 });

      renderAt('/properties/new?imobiliariaId=1&returnTo=/requests/new');

      await userEvent.setup().click(screen.getByRole('button', { name: /salvar imóvel/i }));

      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
      expect(mockMutateAsync.mock.calls[0][0]).toMatchObject({ imobiliariaId: '1' });

      await waitFor(() => expect(currentPath()).toBe('/requests/new'));
      expect(currentSearch()).toContain('createdImovelId=99');
    });

    it('trava o campo de imobiliária quando o id vem na URL', () => {
      renderAt('/properties/new?imobiliariaId=1&returnTo=/requests/new');

      expect(screen.getByLabelText('Imobiliária')).toBeDisabled();
    });

    it('o "Voltar" do topo respeita returnTo e não cria imóvel', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue({ id: '99' });
      vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);

      renderAt('/properties/new?imobiliariaId=1&returnTo=/requests/new');

      await userEvent.setup().click(screen.getAllByRole('button', { name: 'Voltar' })[0]);

      expect(currentPath()).toBe('/requests/new');
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('autofill de endereço por CEP (passo Endereço)', () => {
    const cepMatch = {
      cep: '70714-520',
      logradouro: 'SQN 210 Bloco C',
      complemento: 'Apto 302',
      bairro: 'Asa Norte',
      localidade: 'Brasília',
      uf: 'DF',
    };

    it('CEP de cidade cadastrada preenche cidadeId, address e complemento', async () => {
      vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({ data: cepMatch, isFetching: false } as any);
      const user = userEvent.setup();
      renderComponent();

      await user.type(screen.getByLabelText('CEP'), '70714520');

      await waitFor(
        () => expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('Brasília/DF'),
        { timeout: 2000 },
      );
      expect(screen.getByLabelText('Rua')).toHaveValue('SQN 210 Bloco C');
      expect(screen.getByLabelText('Complemento (opcional)')).toHaveValue('Apto 302');
    });

    it('CEP de cidade não cadastrada deixa cidadeId vazio e mostra a dica', async () => {
      vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({
        data: { ...cepMatch, localidade: 'Curitiba', uf: 'PR' },
        isFetching: false,
      } as any);
      const user = userEvent.setup();
      renderComponent();

      await user.type(screen.getByLabelText('CEP'), '80010000');

      await waitFor(
        () => expect(screen.getByText(/não está cadastrada/i)).toBeInTheDocument(),
        { timeout: 2000 },
      );
      expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('');
    });

    it('inclui numero e complemento no payload de criação', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue({ id: '5' });
      vi.mocked(imoveisApi.useCreateImovel).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);
      vi.mocked(imoveisApi.useEnderecoPorCep).mockReturnValue({
        data: {
          cep: '70714-520',
          logradouro: 'Rua X',
          complemento: 'Casa 2',
          localidade: 'Brasília',
          uf: 'DF',
        },
        isFetching: false,
      } as any);
      const user = userEvent.setup();
      renderComponent();
      await user.type(screen.getByLabelText('CEP'), '70714520');
      await waitFor(() => {
        expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('Brasília/DF');
      });
      await user.clear(screen.getByLabelText('Número'));
      await user.type(screen.getByLabelText('Número'), '99');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      await user.selectOptions(screen.getByLabelText('Tipo'), 'Casa');
      await user.type(screen.getByPlaceholderText('Ex: 120'), '75');
      await user.click(screen.getByRole('button', { name: /próximo/i }));
      await user.click(screen.getByRole('button', { name: /salvar imóvel/i }));

      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
      expect(mockMutateAsync.mock.calls[0][0]).toMatchObject({ numero: '99', complemento: 'Casa 2' });
    });
  });
});
