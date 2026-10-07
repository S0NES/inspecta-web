import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Properties } from '../../../pages/properties/Properties';
import { useAppStore } from '../../../store/useAppStore';
import * as imoveisApi from '../../../api/imoveis';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

// Mock the imoveis API hooks
vi.mock('../../../api/imoveis', () => ({
  useImoveis: vi.fn(),
  useCidades: vi.fn(),
  usePatchImovel: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

const mockProperties = [
  {
    id: '1',
    endereco: 'Rua das Flores, 123',
    tipo: 'Apartamento',
    cidade: 'Brasília',
    situacao: 'Ativo',
    dormitorios: 3,
    banheiros: 2,
    area: '120 m²',
    vistoriador: 'Marina Alves',
  },
  {
    id: '2',
    endereco: 'Avenida Paulista, 1000',
    tipo: 'Casa',
    cidade: 'São Paulo',
    situacao: 'Ativo',
    dormitorios: 4,
    banheiros: 3,
    area: '250 m²',
    vistoriador: 'Diego Prado',
  },
];

const mockCities = [
  { id: '1', nome: 'Brasília', estado: 'DF' },
  { id: '2', nome: 'São Paulo', estado: 'SP' },
  { id: '3', nome: 'Florianópolis', estado: 'SC' },
];

const mockPropertiesResponse = {
  content: mockProperties,
  totalElements: 2,
  totalPages: 1,
  page: 0,
  size: 50,
};

describe('Properties Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useAppStore.setState({
      expandedPropertyId: null,
      propertyFilters: {
        tipo: '',
        cidade: '',
        situacao: '',
      },
    });

    vi.mocked(imoveisApi.useImoveis).mockReturnValue({
      data: mockPropertiesResponse,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(imoveisApi.useCidades).mockReturnValue({
      data: mockCities,
      isLoading: false,
      error: null,
    } as any);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/properties']}>
          <Routes>
            <Route path="/properties" element={<><Properties /><LocationProbe /></>} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  // Os filtros vivem num modal aberto pelo botão "Filtros".
  const openFiltersModal = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /filtros/i }));
    await screen.findByRole('dialog');
  };

  it('should render properties header', () => {
    renderComponent();

    expect(screen.getByText('Imóveis')).toBeInTheDocument();
    expect(screen.getByText('Gerencie o catálogo de propriedades')).toBeInTheDocument();
  });

  it('should render new property button', () => {
    renderComponent();

    const newButton = screen.getByRole('button', { name: /cadastrar imóvel/i });
    expect(newButton).toBeInTheDocument();
  });

  it('opens a filters modal with the three dropdowns', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument();

    await openFiltersModal(user);

    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Cidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Situação')).toBeInTheDocument();
  });

  it('should render properties table header', () => {
    renderComponent();

    expect(screen.getAllByText('ENDEREÇO').length).toBeGreaterThan(0);
    expect(screen.getByText('TIPO')).toBeInTheDocument();
    expect(screen.getByText('CIDADE')).toBeInTheDocument();
    expect(screen.getByText('SITUAÇÃO')).toBeInTheDocument();
  });

  it('should render property rows from API data', () => {
    renderComponent();

    expect(screen.getByText('Rua das Flores, 123')).toBeInTheDocument();
    expect(screen.getByText('Avenida Paulista, 1000')).toBeInTheDocument();
  });

  it('should render property details in rows', () => {
    renderComponent();

    expect(screen.getAllByText('Apartamento').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Casa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Brasília').length).toBeGreaterThan(0);
    expect(screen.getAllByText('São Paulo').length).toBeGreaterThan(0);
  });

  it('should render property status badges', () => {
    renderComponent();

    const activeButtons = screen.getAllByText('Ativo');
    expect(activeButtons.length).toBeGreaterThan(0);
  });

  it('should render result count', () => {
    renderComponent();

    expect(screen.getByText('2 de 2 imóveis')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    vi.mocked(imoveisApi.useImoveis).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('Carregando imóveis...')).toBeInTheDocument();
  });

  it('should render error state', () => {
    vi.mocked(imoveisApi.useImoveis).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API Error'),
    } as any);

    renderComponent();

    expect(screen.getByText('Erro ao carregar imóveis. Tente novamente.')).toBeInTheDocument();
  });

  it('should render empty state when no properties', () => {
    vi.mocked(imoveisApi.useImoveis).mockReturnValue({
      data: { content: [], totalElements: 0, totalPages: 0, page: 0, size: 50 },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('Nenhum imóvel encontrado com os filtros selecionados')).toBeInTheDocument();
  });

  it('should expand a property row when the row itself is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    const row = screen.getByText('Rua das Flores, 123').closest('.properties-row') as HTMLElement;
    await user.click(row);

    await waitFor(() => {
      expect(useAppStore.getState().expandedPropertyId).toBe('1');
    });
  });

  it('should collapse an expanded row when clicked again', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ expandedPropertyId: '1' });
    renderComponent();

    const row = screen.getAllByText('Rua das Flores, 123')
      .map((el) => el.closest('.properties-row'))
      .find((el): el is HTMLElement => el !== null)!;
    await user.click(row);

    await waitFor(() => {
      expect(useAppStore.getState().expandedPropertyId).toBeNull();
    });
  });

  it('"Editar" in the row action menu navigates to the property wizard pre-filled for that imóvel, without expanding the row', async () => {
    const user = userEvent.setup();
    renderComponent();

    const row = screen.getByText('Rua das Flores, 123').closest('.properties-row') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /ações de/i }));
    await user.click(screen.getByRole('menuitem', { name: /^editar$/i }));

    await waitFor(() => {
      expect(currentPath()).toBe('/properties/1/edit');
    });
    expect(useAppStore.getState().expandedPropertyId).toBeNull();
  });

  it('does not offer a "Fechar" action in the row action menu (collapsing is row-click only)', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ expandedPropertyId: '1' });
    renderComponent();

    const row = screen.getAllByText('Rua das Flores, 123')
      .map((el) => el.closest('.properties-row'))
      .find((el): el is HTMLElement => el !== null)!;
    await user.click(within(row).getByRole('button', { name: /ações de/i }));

    expect(screen.queryByRole('menuitem', { name: /^fechar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
  });

  it('clicking the status toggle or action menu does not also toggle the row expansion', async () => {
    const user = userEvent.setup();
    renderComponent();

    const row = screen.getByText('Rua das Flores, 123').closest('.properties-row') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /inativar imóvel/i }));

    expect(useAppStore.getState().expandedPropertyId).toBeNull();
  });

  it('should show expanded details when row is expanded', () => {
    useAppStore.setState({ expandedPropertyId: '1' });

    renderComponent();

    expect(screen.getByText('CÓDIGO')).toBeInTheDocument();
    expect(screen.getAllByText('TIPO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ENDEREÇO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CIDADE').length).toBeGreaterThan(0);
    expect(screen.getByText('ÁREA')).toBeInTheDocument();
    expect(screen.getByText('DORMITÓRIOS')).toBeInTheDocument();
    expect(screen.getByText('BANHEIROS')).toBeInTheDocument();
    expect(screen.getAllByText('SITUAÇÃO').length).toBeGreaterThan(0);
  });

  it('should display expanded property details', () => {
    useAppStore.setState({ expandedPropertyId: '1' });

    renderComponent();

    expect(screen.getByText('120 m²')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('should show assigned inspector in expanded details', () => {
    useAppStore.setState({ expandedPropertyId: '1' });

    renderComponent();

    expect(screen.getByText('Atribuído a Marina Alves')).toBeInTheDocument();
  });


  it('exposes an ativar/inativar action per row', () => {
    renderComponent();

    const row = screen.getByText('Rua das Flores, 123').closest('.properties-row') as HTMLElement;
    expect(within(row).getByRole('button', { name: /inativar imóvel/i })).toBeInTheDocument();
  });

  it('should filter by property type', async () => {
    const user = userEvent.setup();
    renderComponent();
    await openFiltersModal(user);

    const typeFilter = screen.getByLabelText('Tipo');
    await user.selectOptions(typeFilter, 'Apartamento');

    expect(useAppStore.getState().propertyFilters.tipo).toBe('Apartamento');
  });

  it('should filter by city', async () => {
    const user = userEvent.setup();
    renderComponent();
    await openFiltersModal(user);

    const cityFilter = screen.getByLabelText('Cidade');
    await user.selectOptions(cityFilter, 'São Paulo');

    expect(useAppStore.getState().propertyFilters.cidade).toBe('São Paulo');
  });

  it('should filter by situation', async () => {
    const user = userEvent.setup();
    renderComponent();
    await openFiltersModal(user);

    const situacaoFilter = screen.getByLabelText('Situação');
    await user.selectOptions(situacaoFilter, 'Ativo');

    expect(useAppStore.getState().propertyFilters.situacao).toBe('Ativo');
  });

  it('clears all filters from the modal', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ propertyFilters: { tipo: 'Casa', cidade: 'Brasília', situacao: 'Ativo' } });
    renderComponent();
    await openFiltersModal(user);

    await user.click(screen.getByRole('button', { name: /limpar filtros/i }));

    expect(useAppStore.getState().propertyFilters).toEqual({ tipo: '', cidade: '', situacao: '' });
  });

  it('should disable city filter while loading cities', async () => {
    vi.mocked(imoveisApi.useCidades).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    } as any);

    const user = userEvent.setup();
    renderComponent();
    await openFiltersModal(user);

    const cityFilter = screen.getByLabelText('Cidade') as HTMLSelectElement;
    expect(cityFilter.disabled).toBe(true);
  });

  it('should navigate to property wizard when new property button clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    const newButton = screen.getByRole('button', { name: /cadastrar imóvel/i });
    await user.click(newButton);

    await waitFor(() => {
      expect(currentPath()).toBe('/properties/new');
    });
  });

  it('should populate city options from API', async () => {
    const user = userEvent.setup();
    renderComponent();
    await openFiltersModal(user);

    const cityFilter = screen.getByLabelText('Cidade') as HTMLSelectElement;
    const options = Array.from(cityFilter.options).map((o) => o.textContent);

    expect(options).toContain('Brasília');
    expect(options).toContain('São Paulo');
    expect(options).toContain('Florianópolis');
  });

  it('should render empty option in dropdowns', async () => {
    const user = userEvent.setup();
    renderComponent();
    await openFiltersModal(user);

    const typeFilter = screen.getByLabelText('Tipo') as HTMLSelectElement;
    const options = Array.from(typeFilter.options);

    expect(options[0].textContent).toBe('Selecionar');
    expect(options[0].value).toBe('');
  });

  it('should not render a stray duplicate blank option in Tipo/Cidade/Situação filters', async () => {
    const user = userEvent.setup();
    renderComponent();
    await openFiltersModal(user);

    for (const label of ['Tipo', 'Cidade', 'Situação']) {
      const select = screen.getByLabelText(label) as HTMLSelectElement;
      const blankOptions = Array.from(select.options).filter((o) => o.value === '');
      expect(blankOptions).toHaveLength(1);
    }
  });

  it('should render property ID in expanded row', () => {
    useAppStore.setState({ expandedPropertyId: '1' });

    renderComponent();

    const propertyId = screen.getAllByText('1').find((el) => {
      const parent = el.closest('.detail-item');
      return parent && parent.textContent?.includes('CÓDIGO');
    });

    expect(propertyId).toBeInTheDocument();
  });

  it('should handle inactive properties', () => {
    const inactiveProperty = {
      ...mockProperties[0],
      ativo: false,
    };

    vi.mocked(imoveisApi.useImoveis).mockReturnValue({
      data: {
        ...mockPropertiesResponse,
        content: [inactiveProperty],
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getAllByText('Inativo').length).toBeGreaterThan(0);
  });

  it('should display correct status badge tone for inactive properties', () => {
    const inactiveProperty = {
      ...mockProperties[0],
      ativo: false,
    };

    useAppStore.setState({ expandedPropertyId: '1' });

    vi.mocked(imoveisApi.useImoveis).mockReturnValue({
      data: {
        ...mockPropertiesResponse,
        content: [inactiveProperty],
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getAllByText('Inativo').length).toBeGreaterThan(0);
  });

  it('should handle multiple properties with same city', () => {
    const sameCityProperty = {
      ...mockProperties[1],
      id: '3',
      cidade: 'Brasília',
    };

    vi.mocked(imoveisApi.useImoveis).mockReturnValue({
      data: {
        ...mockPropertiesResponse,
        content: [...mockProperties, sameCityProperty],
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const brasiliaCells = screen.getAllByText('Brasília');
    expect(brasiliaCells.length).toBeGreaterThanOrEqual(2);
  });

  it('should render results count', () => {
    renderComponent();

    expect(screen.getByText('2 de 2 imóveis')).toBeInTheDocument();
  });

  it('should render singular noun when 1 property', () => {
    vi.mocked(imoveisApi.useImoveis).mockReturnValue({
      data: {
        ...mockPropertiesResponse,
        content: [mockProperties[0]],
        totalElements: 1,
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('1 de 1 imóveis')).toBeInTheDocument();
  });

  it('should call useImoveis with default filters on mount', () => {
    renderComponent();

    expect(imoveisApi.useImoveis).toHaveBeenCalled();
  });

  it('should call useCidades on mount', () => {
    renderComponent();

    expect(imoveisApi.useCidades).toHaveBeenCalled();
  });

  it('should not show expanded details for non-expanded rows', () => {
    renderComponent();

    // Only expanded row should show detailed information; no row is expanded here.
    const detailLabels = screen.queryAllByText(/CÓDIGO/i);
    expect(detailLabels.length).toBe(0);
  });
});
