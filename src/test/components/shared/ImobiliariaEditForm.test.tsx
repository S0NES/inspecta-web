import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BiletagemSection } from '../../../components/shared/ImobiliariaEditForm';
import * as servicosApi from '../../../api/servicos';
import * as contratosApi from '../../../api/contratos';

vi.mock('../../../api/servicos', () => ({ useServicos: vi.fn() }));
vi.mock('../../../api/contratos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/contratos')>();
  return {
    ...actual,
    useImobiliariaContrato: vi.fn(),
    usePutContrato: vi.fn(),
    usePutContratoGrupos: vi.fn(),
    usePutContratoFaixas: vi.fn(),
  };
});

const imob = {
  id: '1', razaoSocial: 'Imob Um Ltda', nomeFantasia: 'Imob Um', cnpj: '11.111.111/0001-11', ativa: true,
};

// Catálogo de faixas como o backend (B2) devolve — rótulos/intervalos próprios,
// faixa 5 com metragemMax null.
const faixaReferencia = [
  { id: '1', ordem: 1, metragemMin: 0, metragemMax: 45, rotulo: 'Compacto (até 45 m²)' },
  { id: '2', ordem: 2, metragemMin: 45, metragemMax: 80, rotulo: 'Médio (45–80 m²)' },
  { id: '3', ordem: 3, metragemMin: 80, metragemMax: 130, rotulo: 'Grande (80–130 m²)' },
  { id: '4', ordem: 4, metragemMin: 130, metragemMax: 200, rotulo: 'Amplo (130–200 m²)' },
  { id: '5', ordem: 5, metragemMin: 200, metragemMax: null, rotulo: 'Acima de 200 m²' },
];

const contratoResumo = {
  modo: 'faixa' as const,
  percentual: null,
  percentualMinimo: null,
  grupos: [],
  faixas: [],
  faixaReferencia,
};

describe('ImobiliariaEditForm — Biletagem', () => {
  let qc: QueryClient;
  const putContrato = vi.fn().mockResolvedValue({});
  const putGrupos = vi.fn().mockResolvedValue({});
  const putFaixas = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.mocked(servicosApi.useServicos).mockReturnValue({
      data: [{ id: '10', nome: 'Elegance', ativo: true, tipos: [{ id: '1', nome: 'Entrada' }] }],
      isLoading: false, error: null,
    } as any);
    vi.mocked(contratosApi.useImobiliariaContrato).mockReturnValue({ data: contratoResumo, isError: false } as any);
    vi.mocked(contratosApi.usePutContrato).mockReturnValue({ mutateAsync: putContrato, isPending: false } as any);
    vi.mocked(contratosApi.usePutContratoGrupos).mockReturnValue({ mutateAsync: putGrupos, isPending: false } as any);
    vi.mocked(contratosApi.usePutContratoFaixas).mockReturnValue({ mutateAsync: putFaixas, isPending: false } as any);
  });

  const renderForm = () =>
    render(
      <QueryClientProvider client={qc}>
        <BiletagemSection imobiliariaId={imob.id} onToast={() => {}} />
      </QueryClientProvider>,
    );

  it('mostra os dois cartões de biletagem, mutuamente exclusivos', async () => {
    const user = userEvent.setup();
    renderForm();

    const faixa = screen.getByRole('radio', { name: /Faixa de metragem/ });
    const percentual = screen.getByRole('radio', { name: /Percentual do aluguel/ });

    expect(faixa).toBeChecked();
    expect(percentual).not.toBeChecked();

    await user.click(percentual);
    expect(percentual).toBeChecked();
    expect(faixa).not.toBeChecked();
  });

  it('modo faixa: usa os rótulos/intervalos de faixaReferencia do backend', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Elegance' }));

    // rótulos vêm do mock do backend, não da constante local
    expect(screen.getByText('Compacto (até 45 m²)')).toBeInTheDocument();
    expect(screen.getByText('Acima de 200 m²')).toBeInTheDocument();
    expect(screen.queryByText('0 – 40 m²')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Compacto (até 45 m²) sem mobília')).toBeInTheDocument();
    expect(screen.getByLabelText('Compacto (até 45 m²) com mobília')).toBeInTheDocument();
    // só a faixa 5 (metragemMax null) tem os campos de incremento
    expect(screen.getByLabelText('Incremento Z por passo')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Passo de metragem (m²)')).toHaveLength(1);
  });

  it('cai no fallback local FAIXAS_REFERENCIA quando o backend não manda faixaReferencia', async () => {
    vi.mocked(contratosApi.useImobiliariaContrato).mockReturnValue({
      data: { ...contratoResumo, faixaReferencia: [] }, isError: false,
    } as any);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Elegance' }));
    expect(screen.getByText('0 – 40 m²')).toBeInTheDocument();
    expect(screen.getByText('acima de 195 m² (+75 m²)')).toBeInTheDocument();
  });

  it('modo percentual: troca a tabela por campos de % e valor mínimo por serviço', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /Percentual do aluguel/ }));
    await user.click(screen.getByRole('button', { name: 'Elegance' }));

    expect(screen.getByLabelText('% do aluguel')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor mínimo')).toBeInTheDocument();
    expect(screen.queryByText('0 – 40 m²')).not.toBeInTheDocument();
  });

  it('salva a biletagem: PUT contrato + grupos + faixas como array (servicoId, faixaId)', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Elegance' }));
    await user.type(screen.getByLabelText('Compacto (até 45 m²) sem mobília'), '250');
    await user.type(screen.getByLabelText('Acima de 200 m² com mobília'), '900');
    await user.click(screen.getByText('Salvar biletagem'));

    expect(putContrato).toHaveBeenCalledWith(expect.objectContaining({ imobiliariaId: '1', modo: 'faixa' }));
    expect(putGrupos).toHaveBeenCalledWith(expect.objectContaining({ imobiliariaId: '1' }));

    expect(putFaixas).toHaveBeenCalledTimes(1);
    const { imobiliariaId, faixas } = putFaixas.mock.calls[0][0];
    expect(imobiliariaId).toBe('1');
    // uma linha por (servicoId, faixaId) que o usuário tocou
    expect(faixas.every((f: any) => f.servicoId === '10')).toBe(true);
    const f1 = faixas.find((f: any) => f.faixaId === '1');
    expect(f1).toMatchObject({ servicoId: '10', faixaId: '1', valorSemMobilia: 250 });
    // faixa 5 carrega o passo (default 75) + incremento; as demais mandam null
    const f5 = faixas.find((f: any) => f.faixaId === '5');
    expect(f5).toMatchObject({ faixaId: '5', valorComMobilia: 900, paStepMetragem: 75 });
    expect(f1.paStepMetragem).toBeNull();
  });

  it('mantém faixa e percentual mutuamente exclusivos ao salvar (percentual não manda faixas)', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /Percentual do aluguel/ }));
    await user.click(screen.getByRole('button', { name: 'Elegance' }));
    await user.click(screen.getByText('Salvar biletagem'));

    expect(putContrato).toHaveBeenCalledWith(expect.objectContaining({ modo: 'percentual' }));
    expect(putFaixas).not.toHaveBeenCalled();
  });
});
