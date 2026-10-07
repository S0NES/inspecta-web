import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PagarSolicitacao } from '../../../pages/pagamento/PagarSolicitacao';
import * as pagamentoApi from '../../../api/pagamento';

vi.mock('../../../api/pagamento', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/pagamento')>();
  return { ...actual, useCobranca: vi.fn(), useCriarCobranca: vi.fn(), useCriarPix: vi.fn() };
});

const cobranca = (over: Partial<pagamentoApi.Cobranca> = {}) =>
  ({
    data: {
      pagamentoId: null, status: null, checkoutUrl: null, checkoutId: null, checkoutReady: false,
      paymentStatus: null, pixBrCode: null, pixQrCodeBase64: null, pixExpiraEm: null, ...over,
    },
    isLoading: false,
  }) as any;

const emDezMinutos = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

function renderPage(id: string | null = '7') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[id == null ? '/sem-id' : `/solicitacoes/${id}/pagar`]}>
        <Routes>
          <Route path="/solicitacoes/:id/pagar" element={<PagarSolicitacao />} />
          <Route path="/sem-id" element={<PagarSolicitacao />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PagarSolicitacao', () => {
  const criarPixMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    criarPixMutate.mockResolvedValue({});
    vi.mocked(pagamentoApi.useCriarCobranca).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(pagamentoApi.useCriarPix).mockReturnValue(
      { mutateAsync: criarPixMutate, isPending: false, isError: false } as any,
    );
    vi.mocked(pagamentoApi.useCobranca).mockReturnValue(cobranca());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('com checkoutUrl oferece o cartão numa nova janela, sem iframe', () => {
    vi.mocked(pagamentoApi.useCobranca).mockReturnValue(
      cobranca({ checkoutUrl: 'https://pay.example/chk_1', status: 'pendente' }),
    );
    renderPage();

    expect(document.querySelector('iframe')).toBeNull();
    const link = screen.getByRole('link', { name: /pagar com cartão/i });
    expect(link).toHaveAttribute('href', 'https://pay.example/chk_1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByText(/aguardando a confirmação/i, { selector: '.pagamento-checkout-hospedado *' })).not.toBeInTheDocument();
    fireEvent.click(link);
    expect(screen.getByText(/aguardando a confirmação/i, { selector: '.pagamento-checkout-hospedado *' })).toBeInTheDocument();
  });

  it('reconsulta a cobrança enquanto aguarda o QR do PIX recém-pedido', () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    vi.mocked(pagamentoApi.useCriarPix).mockReturnValue(
      { mutateAsync: criarPixMutate, isPending: false, isError: false, isSuccess: true } as any,
    );
    vi.mocked(pagamentoApi.useCobranca).mockReturnValue({ ...cobranca(), refetch } as any);
    renderPage();
    vi.advanceTimersByTime(3100);
    expect(refetch).toHaveBeenCalled();
  });

  it('oferece pagar com cartão quando o checkout hospedado ainda não existe', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /pagar com cartão/i })).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('mostra estado de já pago e não pede PIX', () => {
    vi.mocked(pagamentoApi.useCobranca).mockReturnValue(cobranca({ status: 'pago' }));
    renderPage();
    expect(screen.getByText(/já foi confirmado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver solicitação/i })).toBeInTheDocument();
    expect(criarPixMutate).not.toHaveBeenCalled();
  });

  it('sem solicitação selecionada mostra aviso', () => {
    renderPage(null);
    expect(screen.getByText(/nenhuma solicitação selecionada/i)).toBeInTheDocument();
  });

  describe('PIX transparente', () => {
    it('pede o PIX automaticamente, uma única vez, ao abrir a tela sem PIX', async () => {
      const { rerender } = renderPage();
      await waitFor(() => expect(criarPixMutate).toHaveBeenCalledWith('7'));
      expect(screen.getByText(/gerando o pix/i)).toBeInTheDocument();
      rerender(<div />);
      expect(criarPixMutate).toHaveBeenCalledTimes(1);
    });

    it('exibe QR Code, copia-e-cola e contador quando o PIX está vigente — sem pedir outro', () => {
      vi.mocked(pagamentoApi.useCobranca).mockReturnValue(cobranca({
        status: 'pendente', pixBrCode: '00020126BRCODE', pixQrCodeBase64: 'data:image/png;base64,AAA',
        pixExpiraEm: emDezMinutos(),
      }));
      renderPage();

      expect(screen.getByAltText('QR Code do PIX')).toHaveAttribute('src', 'data:image/png;base64,AAA');
      expect(screen.getByLabelText('Código copia e cola')).toHaveValue('00020126BRCODE');
      expect(screen.getByRole('timer')).toHaveTextContent(/expira em (09:[5-9]\d|10:00)/i);
      expect(screen.getByText(/aguardando a confirmação/i)).toBeInTheDocument();
      expect(criarPixMutate).not.toHaveBeenCalled();
    });

    it('botão Copiar código usa a área de transferência', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      vi.mocked(pagamentoApi.useCobranca).mockReturnValue(cobranca({
        status: 'pendente', pixBrCode: '00020126BRCODE', pixQrCodeBase64: 'data:image/png;base64,AAA',
        pixExpiraEm: emDezMinutos(),
      }));
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /copiar código/i }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('00020126BRCODE'));
    });

    it('PIX expirado mostra aviso e permite gerar outro', () => {
      vi.mocked(pagamentoApi.useCobranca).mockReturnValue(cobranca({
        status: 'pendente', pixBrCode: '00020126BRCODE', pixQrCodeBase64: 'data:image/png;base64,AAA',
        pixExpiraEm: new Date(Date.now() - 60_000).toISOString(),
      }));
      renderPage();

      expect(screen.getByText(/este pix expirou/i)).toBeInTheDocument();
      expect(screen.queryByAltText('QR Code do PIX')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /gerar novo pix/i }));
      // 1 chamada automática ao abrir (expirado conta como "sem PIX vigente") + 1 clique manual.
      expect(criarPixMutate).toHaveBeenCalledTimes(2);
    });

    it('falha ao gerar o PIX mostra erro e botão para tentar de novo', () => {
      vi.mocked(pagamentoApi.useCriarPix).mockReturnValue(
        { mutateAsync: criarPixMutate, isPending: false, isError: true } as any,
      );
      renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível gerar o pix/i);
      expect(screen.getByRole('button', { name: /gerar novo pix/i })).toBeInTheDocument();
    });
  });
});
