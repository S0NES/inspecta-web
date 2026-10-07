import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { FaturasPanel, periodoDoMes } from '../../../pages/extratos/FaturasPanel';
import { useAppStore } from '../../../store/useAppStore';
import * as extratoApi from '../../../api/extrato';
import { ApiError } from '../../../api/client';

vi.mock('../../../api/extrato', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/extrato')>();
  return { ...actual, useExtratoItens: vi.fn(), useFaturas: vi.fn(), useGerarFaturaConsolidada: vi.fn() };
});

/** 2026-10-02: setembro já encerrado; outubro ainda aberto. */
const HOJE = new Date(2026, 9, 2);

const item = (valor: number) => ({ id: `i${valor}`, valor }) as any;

const fatura = (over: Partial<extratoApi.FaturaConsolidada> = {}): extratoApi.FaturaConsolidada => ({
  id: 'f1', periodoInicio: '2026-09-01', periodoFim: '2026-09-30', valorTotal: 200,
  status: 'checkout_ready', checkoutUrl: 'https://pay.example/chk_f1', criadoEm: '2026-10-02T00:00:00Z', ...over,
});

describe('periodoDoMes', () => {
  it('devolve primeiro e último dia, inclusive em mês de 30/28 dias', () => {
    expect(periodoDoMes('2026-10')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' });
    expect(periodoDoMes('2026-04')).toEqual({ inicio: '2026-04-01', fim: '2026-04-30' });
    expect(periodoDoMes('2026-02')).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' });
  });
});

describe('FaturasPanel', () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ toastMessage: null } as any);
    mutateAsync.mockResolvedValue({ faturaId: 'f1', valorTotal: 200 });
    vi.mocked(extratoApi.useExtratoItens).mockReturnValue({ data: [item(200)], isLoading: false } as any);
    vi.mocked(extratoApi.useFaturas).mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() } as any);
    vi.mocked(extratoApi.useGerarFaturaConsolidada).mockReturnValue({ mutateAsync, isPending: false } as any);
  });

  it('resume os itens em aberto do mês e gera a fatura do período com chave de idempotência', async () => {
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);

    expect(screen.getByTestId('fatura-aberto')).toHaveTextContent(/1 · R\$\s?200,00/);
    fireEvent.click(screen.getByRole('button', { name: /gerar fatura do mês/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      inicio: '2026-09-01', fim: '2026-09-30', idempotencyKey: 'fatura-imo-1-2026-09-01-2026-09-30',
    }));
    await waitFor(() => expect(useAppStore.getState().toastMessage).toMatch(/fatura gerada/i));
  });

  it('sem itens em aberto o botão fica desabilitado', () => {
    vi.mocked(extratoApi.useExtratoItens).mockReturnValue({ data: [], isLoading: false } as any);
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);
    expect(screen.getByRole('button', { name: /gerar fatura do mês/i })).toBeDisabled();
  });

  it('"Pagar fatura" abre o checkout num modal dentro do inspecta-web', () => {
    vi.mocked(extratoApi.useFaturas).mockReturnValue({ data: [fatura()], isLoading: false, refetch: vi.fn() } as any);
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);

    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pagar fatura/i }));
    const dialog = screen.getByRole('dialog');
    const link = within(dialog).getByRole('link', { name: /pagar com cartão/i });
    expect(link).toHaveAttribute('href', 'https://pay.example/chk_f1');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('modal mostra confirmação quando a fatura vira paga', () => {
    const useFaturas = vi.mocked(extratoApi.useFaturas);
    useFaturas.mockReturnValue({ data: [fatura()], isLoading: false, refetch: vi.fn() } as any);
    const { rerender } = render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);
    fireEvent.click(screen.getByRole('button', { name: /pagar fatura/i }));
    useFaturas.mockReturnValue({ data: [fatura({ status: 'pago' })], isLoading: false, refetch: vi.fn() } as any);
    rerender(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);
    expect(within(screen.getByRole('dialog')).getByText(/fatura paga/i)).toBeInTheDocument();
  });

  it('fatura paga não oferece link de pagamento', () => {
    vi.mocked(extratoApi.useFaturas).mockReturnValue(
      { data: [fatura({ status: 'pago' })], isLoading: false, refetch: vi.fn() } as any);
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);

    expect(screen.getByText('Paga')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pagar fatura/i })).not.toBeInTheDocument();
  });

  it('fatura pendente mostra "Preparando checkout…" e reconsulta a lista periodicamente', () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    vi.mocked(extratoApi.useFaturas).mockReturnValue(
      { data: [fatura({ status: 'pendente', checkoutUrl: null })], isLoading: false, refetch } as any);
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);

    expect(screen.getByText(/preparando checkout/i)).toBeInTheDocument();
    vi.advanceTimersByTime(3100);
    expect(refetch).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('erro ao gerar mostra a mensagem do backend em toast', async () => {
    mutateAsync.mockRejectedValue(new Error('sem_itens_abertos_no_periodo'));
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);

    fireEvent.click(screen.getByRole('button', { name: /gerar fatura do mês/i }));

    await waitFor(() => expect(useAppStore.getState().toastMessage).toBe('sem_itens_abertos_no_periodo'));
  });

  it('409 (já existe fatura no período) mostra mensagem explicativa, não o texto técnico', async () => {
    mutateAsync.mockRejectedValue(new ApiError('A operacao conflita com dados existentes', 409, null));
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);

    fireEvent.click(screen.getByRole('button', { name: /gerar fatura do mês/i }));

    await waitFor(() => expect(useAppStore.getState().toastMessage).toMatch(/fatura deste mês já foi gerada/i));
  });

  it('mês em andamento só acumula: botão desabilitado e dica de quando a fatura fica disponível', () => {
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-10" hoje={HOJE} />);

    expect(screen.getByTestId('fatura-aberto')).toHaveTextContent(/1 · R\$\s?200,00/);
    expect(screen.getByRole('button', { name: /gerar fatura do mês/i })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(/a partir de 01\/11\/2026/i);
  });

  it('o último dia do mês ainda conta como mês aberto', () => {
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={new Date(2026, 8, 30)} />);
    expect(screen.getByRole('button', { name: /gerar fatura do mês/i })).toBeDisabled();
  });

  it('mês já faturado: botão desabilitado e dica de que a fatura existe (uma por mês)', () => {
    vi.mocked(extratoApi.useFaturas).mockReturnValue({ data: [fatura()], isLoading: false, refetch: vi.fn() } as any);
    render(<FaturasPanel imobiliariaId="imo-1" mes="2026-09" hoje={HOJE} />);

    expect(screen.getByRole('button', { name: /gerar fatura do mês/i })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(/já foi gerada/i);
  });
});
