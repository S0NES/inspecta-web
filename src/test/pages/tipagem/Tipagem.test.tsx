import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tipagem } from '../../../pages/tipagem/Tipagem';
import { useAppStore } from '../../../store/useAppStore';
import { navMap, flattenNavItems } from '../../../utils/navigation';
import { mapPerfilToRole } from '../../../utils/roleMapper';
import * as servicosApi from '../../../api/servicos';
import * as catalogoApi from '../../../api/catalogo';

vi.mock('../../../api/servicos', () => ({
  useServicos: vi.fn(),
  useCreateServico: vi.fn(),
  usePatchServico: vi.fn(),
  useDeleteServico: vi.fn(),
  useSetTipoPlenoCodigo: vi.fn(),
}));
vi.mock('../../../api/catalogo', () => ({
  useTiposServicoAdmin: vi.fn(),
  useCreateTipoServico: vi.fn(),
  usePatchTipoServico: vi.fn(),
}));

const pageOf = <T,>(content: T[]) => ({ content, totalElements: content.length, totalPages: 1, size: 200, number: 0 });

describe('Tipagem', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({ toastMessage: null });

    vi.mocked(servicosApi.useServicos).mockReturnValue({
      data: [{ id: '10', nome: 'Elegance', ativo: true, tipos: [{ id: '1', nome: 'Entrada', plenoTipVisCodigo: 42 }] }],
      isLoading: false, error: null,
    } as any);
    vi.mocked(servicosApi.useCreateServico).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(servicosApi.usePatchServico).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(servicosApi.useDeleteServico).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(servicosApi.useSetTipoPlenoCodigo).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    vi.mocked(catalogoApi.useTiposServicoAdmin).mockReturnValue({
      data: pageOf([{ id: '1', nome: 'Entrada', ativo: true }, { id: '2', nome: 'Saída', ativo: false }]),
      isLoading: false, error: null,
    } as any);
    vi.mocked(catalogoApi.useCreateTipoServico).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(catalogoApi.usePatchTipoServico).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  });

  const renderComponent = () =>
    render(<QueryClientProvider client={qc}><Tipagem /></QueryClientProvider>);

  it('só é acessível por staff (perfil admin/suporte → role admin) e só aparece na nav do admin', () => {
    expect(mapPerfilToRole('admin')).toBe('admin');
    expect(mapPerfilToRole('suporte')).toBe('admin');
    expect(mapPerfilToRole('imob_gerencia')).toBe('corretor');

    expect(flattenNavItems('admin').some((i) => i.to === '/settings/tipagem')).toBe(true);
    expect(flattenNavItems('corretor').some((i) => i.to === '/settings/tipagem')).toBe(false);
    expect(flattenNavItems('vistoriador').some((i) => i.to === '/settings/tipagem')).toBe(false);
    expect(navMap.admin.find((n) => 'group' in n && n.group === 'config')).toBeTruthy();
  });

  it('mostra o cabeçalho "Tipagem" e as duas abas', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: 'Tipagem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Produtos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Serviço' })).toBeInTheDocument();
  });

  it('aba Produtos lista os produtos e expande para mostrar os serviços agrupados', async () => {
    const user = userEvent.setup();
    renderComponent();
    expect(screen.getByText('Elegance')).toBeInTheDocument();
    expect(screen.queryByText('Entrada')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Elegance' }));
    expect(screen.getByText('Entrada')).toBeInTheDocument();
  });

  it('esconde as ações da linha de produto no menu ⋮, não como links', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ações de Elegance' }));
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Desativar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toBeInTheDocument();
  });

  it('troca para a aba Serviço e lista o catálogo', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: 'Serviço' }));
    expect(screen.getByRole('button', { name: 'Novo serviço' })).toBeInTheDocument();
    expect(screen.getByText('Saída')).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });

  it('esconde as ações da linha de serviço no menu ⋮, não como links', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: 'Serviço' }));

    expect(screen.queryByRole('button', { name: 'Renomear' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ativar' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ações de Entrada' }));
    expect(screen.getByRole('menuitem', { name: 'Renomear' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Desativar' })).toBeInTheDocument();
  });

  it('novo produto: select adiciona um serviço à lista agrupada', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: 'Novo produto' }));
    expect(screen.getByText('Serviços agrupados')).toBeInTheDocument();

    const select = screen.getByRole('combobox', { name: 'Adicionar serviço ao grupo…' });
    expect(within(select).getByRole('option', { name: 'Entrada' })).toBeInTheDocument();
    expect(screen.getByText('Nenhum serviço agrupado ainda.')).toBeInTheDocument();

    await user.selectOptions(select, '1');
    expect(screen.getByRole('listitem')).toHaveTextContent('Entrada');
    expect(screen.queryByRole('option', { name: 'Entrada' })).not.toBeInTheDocument();
  });

  it('ao editar um produto, mostra o ID externo atual do serviço já vinculado', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: 'Ações de Elegance' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const campo = screen.getByLabelText('ID externo de Entrada') as HTMLInputElement;
    expect(campo.value).toBe('42');
  });

  it('salva o ID externo ao perder o foco e mostra um toast', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(servicosApi.useSetTipoPlenoCodigo).mockReturnValue({ mutateAsync, isPending: false } as any);

    renderComponent();
    await user.click(screen.getByRole('button', { name: 'Ações de Elegance' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const campo = screen.getByLabelText('ID externo de Entrada');
    await user.clear(campo);
    await user.type(campo, '99');
    await user.tab();

    expect(mutateAsync).toHaveBeenCalledWith({ servicoId: '10', tipoServicoId: '1', codigo: 99 });
    expect(useAppStore.getState().toastMessage).toBe('ID externo atualizado');
  });
});
