import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineChart } from '../../../components/shared/LineChart';

const labels = ['01/08', '02/08', '03/08', '04/08'];
const series = [
  { nome: 'email', valores: [10, 12, 8, 15] },
  { nome: 'sms', valores: [2, 0, 4, 1] },
  { nome: 'whatsapp', valores: [0, 1, 0, 2] },
];

describe('LineChart', () => {
  it('desenha uma polyline por série', () => {
    const { container } = render(
      <LineChart series={series} labels={labels} ariaLabel="teste" />
    );
    expect(container.querySelectorAll('polyline')).toHaveLength(3);
  });

  it('mostra um item de legenda por série, com o nome', () => {
    const { container } = render(
      <LineChart series={series} labels={labels} ariaLabel="teste" />
    );
    expect(container.querySelectorAll('.linechart-legend-item')).toHaveLength(3);
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('sms')).toBeInTheDocument();
    expect(screen.getByText('whatsapp')).toBeInTheDocument();
  });

  it('expõe o ariaLabel no SVG do gráfico', () => {
    const { container } = render(
      <LineChart series={series} labels={labels} ariaLabel="Envios por dia" />
    );
    expect(container.querySelector('svg[role="img"]')).toHaveAttribute(
      'aria-label',
      'Envios por dia'
    );
  });

  it('mostra o estado vazio quando não há séries', () => {
    const { container } = render(<LineChart series={[]} labels={[]} ariaLabel="teste" />);
    expect(screen.getByText('Sem dados no período')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('mostra o estado vazio quando todos os valores são zero', () => {
    render(
      <LineChart
        series={[{ nome: 'email', valores: [0, 0, 0] }]}
        labels={['01/08', '02/08', '03/08']}
        ariaLabel="teste"
      />
    );
    expect(screen.getByText('Sem dados no período')).toBeInTheDocument();
  });

  it('mostra o estado de carregamento', () => {
    const { container } = render(
      <LineChart series={series} labels={labels} ariaLabel="teste" loading />
    );
    expect(screen.getByText('Carregando dados…')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeNull();
  });
});
