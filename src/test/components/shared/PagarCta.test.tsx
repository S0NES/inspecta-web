import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { PagarCta } from '../../../components/shared/PagarCta';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

function renderCta(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/requests']}>
      <Routes>
        <Route path="/requests" element={<>{ui}<LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PagarCta', () => {
  it('não renderiza sem checkoutUrl', () => {
    renderCta(<PagarCta solicitacaoId="1" checkoutUrl={null} paymentStatus="checkout_ready" />);
    expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
  });

  it('não renderiza quando o pagamento já foi concluído', () => {
    renderCta(<PagarCta solicitacaoId="1" checkoutUrl="https://pay.example/x" paymentStatus="pago" />);
    expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
  });

  it('renderiza o botão quando há checkout e o pagamento está pendente', () => {
    renderCta(<PagarCta solicitacaoId="1" checkoutUrl="https://pay.example/x" paymentStatus="checkout_ready" />);
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeInTheDocument();
  });

  it('renderiza mesmo sem paymentStatus, desde que exista checkoutUrl', () => {
    renderCta(<PagarCta solicitacaoId="1" checkoutUrl="https://pay.example/x" />);
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeInTheDocument();
  });

  it('abre a tela de pagamento ao clicar', async () => {
    const user = userEvent.setup();
    renderCta(<PagarCta solicitacaoId="42" checkoutUrl="https://pay.example/x" paymentStatus="checkout_ready" />);

    await user.click(screen.getByRole('button', { name: 'Pagar' }));

    expect(currentPath()).toBe('/solicitacoes/42/pagar');
  });
});
