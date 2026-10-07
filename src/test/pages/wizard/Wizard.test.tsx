import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Wizard } from '../../../pages/wizard/Wizard';
import { useAppStore } from '../../../store/useAppStore';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} data-search={loc.search} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');
const currentSearch = () => screen.getByTestId('loc').getAttribute('data-search') ?? '';
import * as solicitacoesApi from '../../../api/solicitacoes';
import * as adminApi from '../../../api/admin';
import * as servicosApi from '../../../api/servicos';
import * as contratosApi from '../../../api/contratos';
import * as imoveisApi from '../../../api/imoveis';
import * as pagamentoApi from '../../../api/pagamento';

vi.mock('../../../api/solicitacoes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/solicitacoes')>();
  return {
    ...actual,
    useImoveis: vi.fn(),
    useIntervenientePapeis: vi.fn(),
    useCreateSolicitacao: vi.fn(),
    usePrecoPreview: vi.fn(),
  };
});
vi.mock('../../../api/admin', () => ({ useImobiliarias: vi.fn() }));
vi.mock('../../../api/servicos', () => ({ useServicos: vi.fn() }));
vi.mock('../../../api/contratos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/contratos')>();
  return { ...actual, useImobiliariaContrato: vi.fn() };
});
vi.mock('../../../api/imoveis', () => ({ useCidades: vi.fn() }));
vi.mock('../../../api/pagamento', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/pagamento')>();
  return { ...actual, useCriarCobranca: vi.fn() };
});

const noPayment = {
  status: 'nao_iniciado' as const,
  checkoutReady: false,
  checkoutId: null,
  checkoutUrl: null,
  required: true,
  reason: null,
};

const page = <T,>(content: T[]) => ({
  content, totalElements: content.length, totalPages: 1, size: 100, number: 0, first: true, last: true,
});

const mockImoveis = [
  { id: '1', imobiliariaId: '1', cidadeId: '1', endereco: 'SQN 210, Bloco C, Apto 302', cep: null, metragem: 78, mobiliado: false, tipo: 'Apartamento', valorAluguel: null },
];
const mockPapeis = [
  { slug: 'locador', nome: 'Locador' },
  { slug: 'locatario', nome: 'Locatário' },
  { slug: 'fiador', nome: 'Fiador' },
];
const mockServicos = [
  { id: '10', nome: 'Elegance', ativo: true, tipos: [{ id: '1', nome: 'Entrada' }, { id: '2', nome: 'Saída' }] },
];
const mockCidades = [{ id: '1', nome: 'Brasília', uf: 'DF' }];
const mockImobiliarias = [
  { id: '1', razaoSocial: 'QA Imóveis LTDA', nomeFantasia: 'QA Imóveis', cnpj: '1', ativa: true },
];

describe('Wizard', () => {
  let queryClient: QueryClient;
  let mutateAsync: ReturnType<typeof vi.fn>;
  let criarCobranca: ReturnType<typeof vi.fn>;
  let refetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({
      wizardStep: 0,
      toastMessage: null,
      role: 'corretor',
      auth: {
        accessToken: 'token', userEmail: 'g@demo.com', userId: '2', perfil: 'imob_gerencia',
        imobiliariaId: '1', imobiliariaIds: ['1'], loginError: null,
      },
    });

    mutateAsync = vi.fn().mockResolvedValue({ id: '1', payment: noPayment, raw: { id: '1' } });
    criarCobranca = vi.fn().mockResolvedValue({ pagamentoId: '1', status: 'pendente', checkoutUrl: null });
    refetch = vi.fn().mockResolvedValue({});

    vi.mocked(solicitacoesApi.useImoveis).mockReturnValue({ data: page(mockImoveis), isLoading: false, error: null, refetch } as any);
    vi.mocked(solicitacoesApi.useIntervenientePapeis).mockReturnValue({ data: mockPapeis } as any);
    vi.mocked(solicitacoesApi.useCreateSolicitacao).mockReturnValue({ mutateAsync, isPending: false } as any);
    vi.mocked(solicitacoesApi.usePrecoPreview).mockReturnValue({ data: { valor: 650, repasse: 400, faixaId: '3' }, isLoading: false, isError: false } as any);
    vi.mocked(adminApi.useImobiliarias).mockReturnValue({ data: page(mockImobiliarias), isLoading: false, error: null } as any);
    vi.mocked(servicosApi.useServicos).mockReturnValue({ data: mockServicos, isLoading: false, error: null } as any);
    vi.mocked(contratosApi.useImobiliariaContrato).mockReturnValue({ data: { modo: 'faixa', percentual: null, percentualMinimo: null, grupos: [{ servicoId: '10' }], faixas: [] }, isError: false } as any);
    vi.mocked(imoveisApi.useCidades).mockReturnValue({ data: mockCidades, isLoading: false, error: null } as any);
    vi.mocked(pagamentoApi.useCriarCobranca).mockReturnValue({ mutateAsync: criarCobranca, isPending: false } as any);
  });

  const renderComponent = (entry = '/requests/new') =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/requests/new" element={<><Wizard /><LocationProbe /></>} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const selecionarImovel = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByText('SQN 210, Bloco C, Apto 302'));
  };
  const preencherServicoEAgenda = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.selectOptions(screen.getByLabelText('Produto'), '10');
    await user.click(screen.getByRole('button', { name: 'Entrada' }));
    fireEvent.change(screen.getByLabelText('Data e hora desejada'), { target: { value: '2026-09-20T10:00' } });
    fireEvent.change(screen.getByLabelText('Valor do aluguel'), { target: { value: '2500' } });
  };
  const preencherInterveniente = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Nome completo'), 'Ana Silva');
    await user.type(screen.getByLabelText('CPF'), '111.444.777-35');
    await user.type(screen.getByLabelText('E-mail'), 'ana@x.co');
  };

  it('renderiza os cinco passos numerados', () => {
    renderComponent();
    ['Imóvel', 'Produto e agenda', 'Intervenientes', 'Vistoriador', 'Confirmação']
      .forEach((l) => expect(screen.getByText(l)).toBeInTheDocument());
  });

  it('imob_gerencia: lista imóveis da própria imobiliária sem seletor de cliente/imobiliária', async () => {
    const user = userEvent.setup();
    renderComponent();
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Imobiliária')).not.toBeInTheDocument();
    expect(screen.getByText('SQN 210, Bloco C, Apto 302')).toBeInTheDocument();
    expect(screen.getByText('Próximo')).toBeDisabled();
    await selecionarImovel(user);
    await waitFor(() => expect(screen.getByText('Próximo')).toBeEnabled());
  });

  it('admin/suporte: mostra o seletor de Imobiliária antes da lista de imóveis', () => {
    useAppStore.setState({
      role: 'admin',
      auth: {
        accessToken: 't', userEmail: 'a@demo.com', userId: '1', perfil: 'admin',
        imobiliariaId: null, imobiliariaIds: [], loginError: null,
      },
    });
    renderComponent();
    expect(screen.getByLabelText('Imobiliária')).toBeInTheDocument();
    expect(screen.queryByText('SQN 210, Bloco C, Apto 302')).not.toBeInTheDocument();
  });

  it('POST envia imovelId + valorAluguel + mobiliado + intervenientes; nunca clienteId nem imobiliariaId; vai para /requests sem cobrança', async () => {
    const user = userEvent.setup();
    renderComponent();

    await selecionarImovel(user);
    await user.click(screen.getByText('Próximo'));
    await preencherServicoEAgenda(user);
    await user.click(screen.getByRole('button', { name: 'Mobiliado' }));
    await user.click(screen.getByText('Próximo'));
    await preencherInterveniente(user);
    await user.click(screen.getByText('Próximo'));
    await user.click(screen.getByText('Próximo'));
    await user.click(screen.getByText('Confirmar solicitação'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const body = mutateAsync.mock.calls[0][0];
    expect(body.imovelId).toBe('1');
    expect(body).not.toHaveProperty('clienteId');
    expect(body).not.toHaveProperty('imobiliariaId');
    expect(body).not.toHaveProperty('acompanham');
    expect(body.valorAluguel).toBe(2500);
    expect(body.mobiliado).toBe(true);
    expect(body.intervenientes).toEqual([
      { papelSlug: 'locador', nome: 'Ana Silva', cpf: '11144477735', email: 'ana@x.co', telefone: null, acompanhante: false },
    ]);
    expect(body.servicos[0].tipoServicoId).toBe('1');

    await waitFor(() => expect(currentPath()).toBe('/requests'));
    expect(criarCobranca).not.toHaveBeenCalled();
  });

  it('contrato percentual: exige Valor do aluguel para avançar da etapa de serviço', async () => {
    vi.mocked(contratosApi.useImobiliariaContrato).mockReturnValue({
      data: { modo: 'percentual', percentual: 8, percentualMinimo: null, grupos: [{ servicoId: '10' }], faixas: [] },
      isError: false,
    } as any);
    const user = userEvent.setup();
    renderComponent();

    await selecionarImovel(user);
    await user.click(screen.getByText('Próximo'));
    await user.selectOptions(screen.getByLabelText('Produto'), '10');
    await user.click(screen.getByRole('button', { name: 'Entrada' }));
    fireEvent.change(screen.getByLabelText('Data e hora desejada'), { target: { value: '2026-09-20T10:00' } });
    expect(screen.getByText('Próximo')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Valor do aluguel *'), { target: { value: '3000' } });
    await waitFor(() => expect(screen.getByText('Próximo')).toBeEnabled());
  });

  it('não avança da etapa de intervenientes com CPF inválido', async () => {
    const user = userEvent.setup();
    renderComponent();
    await selecionarImovel(user);
    await user.click(screen.getByText('Próximo'));
    await preencherServicoEAgenda(user);
    await user.click(screen.getByText('Próximo'));

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Silva');
    await user.type(screen.getByLabelText('CPF'), '111.444.777-34');
    await user.type(screen.getByLabelText('E-mail'), 'ana@x.co');
    expect(screen.getByText('Próximo')).toBeDisabled();

    await user.clear(screen.getByLabelText('CPF'));
    await user.type(screen.getByLabelText('CPF'), '111.444.777-35');
    await waitFor(() => expect(screen.getByText('Próximo')).toBeEnabled());
  });

  it('cadastra imóvel inline: navega para /properties/new com a imobiliária do contexto e salva rascunho', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('CADASTRAR IMÓVEL NOVO'));

    await waitFor(() => expect(currentPath()).toBe('/properties/new'));
    expect(currentSearch()).toContain('imobiliariaId=1');
    expect(currentSearch()).toContain('returnTo=');

    const draft = JSON.parse(localStorage.getItem('mv-solicitacao-draft') as string);
    expect(draft.imobiliariaId).toBe('1');
  });

  it('mostra a estimativa de custo e o RESUMO só na Confirmação', async () => {
    const user = userEvent.setup();
    renderComponent();
    expect(screen.queryByText('RESUMO')).not.toBeInTheDocument();

    await selecionarImovel(user);
    await user.click(screen.getByText('Próximo'));
    await preencherServicoEAgenda(user);
    await user.click(screen.getByText('Próximo'));
    await preencherInterveniente(user);
    await user.click(screen.getByText('Próximo'));
    expect(screen.queryByText('RESUMO')).not.toBeInTheDocument();
    await user.click(screen.getByText('Próximo'));

    expect(screen.getByText('RESUMO')).toBeInTheDocument();
    expect(screen.getByText('Estimativa de custo')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/650,00/).length).toBeGreaterThan(0));
  });
});
