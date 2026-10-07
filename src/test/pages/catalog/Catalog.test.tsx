import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Catalog } from '../../../pages/catalog/Catalog';
import { useAppStore } from '../../../store/useAppStore';
import * as imoveisApi from '../../../api/imoveis';
import * as catalogoApi from '../../../api/catalogo';

vi.mock('../../../api/imoveis', () => ({ useCidades: vi.fn() }));
vi.mock('../../../api/catalogo', () => ({ useCreateCidade: vi.fn(), useDeleteCidade: vi.fn() }));

const cidades = [
  { id: '1', nome: 'Brasília', uf: 'DF' },
  { id: '2', nome: 'São Paulo', uf: 'SP' },
  { id: '3', nome: 'Florianópolis', uf: 'SC' },
];

describe('Catalog (Cidades)', () => {
  let qc: QueryClient;
  const mutateAsync = vi.fn().mockResolvedValue({ id: '4', nome: 'Curitiba', uf: 'PR' });
  const deleteAsync = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({ toastMessage: null });
    vi.mocked(imoveisApi.useCidades).mockReturnValue({
      data: cidades, isLoading: false, error: null,
    } as any);
    vi.mocked(catalogoApi.useCreateCidade).mockReturnValue({
      mutateAsync, isPending: false,
    } as any);
    vi.mocked(catalogoApi.useDeleteCidade).mockReturnValue({
      mutateAsync: deleteAsync, isPending: false,
    } as any);
  });

  const renderIt = () =>
    render(<QueryClientProvider client={qc}><Catalog /></QueryClientProvider>);

  it('mostra o cabeçalho padrão e a lista de cidades', () => {
    renderIt();
    expect(screen.getByRole('heading', { name: 'Cidades' })).toBeInTheDocument();
    expect(screen.getByText('Brasília')).toBeInTheDocument();
    expect(screen.getByText('São Paulo')).toBeInTheDocument();
    expect(screen.getByText('DF')).toBeInTheDocument();
    expect(screen.queryByText(/#1/)).not.toBeInTheDocument();
  });

  it('filtra a lista por nome ou UF', async () => {
    const user = userEvent.setup();
    renderIt();
    await user.click(screen.getByRole('button', { name: /^filtros/i }));
    await user.type(await screen.findByLabelText('Buscar cidade por nome ou UF'), 'sc');
    expect(screen.getByText('Florianópolis')).toBeInTheDocument();
    expect(screen.queryByText('Brasília')).not.toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há cidades', () => {
    vi.mocked(imoveisApi.useCidades).mockReturnValue({ data: [], isLoading: false, error: null } as any);
    renderIt();
    expect(screen.getByText(/Nenhuma cidade cadastrada/)).toBeInTheDocument();
  });

  it('abre o dialog "Nova cidade" e cria pelo botão Adicionar', async () => {
    const user = userEvent.setup();
    renderIt();
    await user.click(screen.getByRole('button', { name: 'Nova cidade' }));
    expect(screen.getByRole('heading', { name: 'Nova cidade' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nome da cidade'), 'Curitiba');
    await user.selectOptions(screen.getByLabelText('UF'), 'PR');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(mutateAsync).toHaveBeenCalledWith({ nome: 'Curitiba', uf: 'PR' });
  });

  it('exclui uma cidade pela ação da linha, com confirmação', async () => {
    const user = userEvent.setup();
    renderIt();

    await user.click(screen.getByRole('button', { name: 'Ações de Brasília' }));
    await user.click(await screen.findByRole('menuitem', { name: /Excluir cidade/ }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    expect(deleteAsync).toHaveBeenCalledWith('1');
  });
});
