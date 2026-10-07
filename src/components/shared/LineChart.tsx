import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import './LineChart.css';

export interface LineChartSerie {
  nome: string;
  valores: number[];
}

interface LineChartProps {
  /** Uma série por linha; `valores` alinhado a `labels` por índice. */
  series: LineChartSerie[];
  /** Rótulos do eixo X (dias), um por ponto. */
  labels: string[];
  /** Altura do desenho em unidades de viewBox. Default 260. */
  height?: number;
  /** Descrição acessível do gráfico (obrigatória — o SVG é `role="img"`). */
  ariaLabel: string;
  loading?: boolean;
}

/**
 * Paleta de 5 séries distinguíveis por **cor + traço** — segue a decisão do plano
 * (neutros + vermelho, sem depender de percepção de cor). Cicla se houver mais de 5.
 */
const PALETA: Array<{ stroke: string; dash?: string }> = [
  { stroke: 'var(--mv-fg, #0f0f0f)' },
  { stroke: 'var(--mv-brand-primary, #0FA68B)' },
  { stroke: 'var(--mv-fg2, rgba(15,15,15,0.68))', dash: '6 3' },
  { stroke: 'var(--mv-fg3, rgba(15,15,15,0.45))', dash: '2 3' },
  { stroke: 'var(--mv-fg, #0f0f0f)', dash: '9 4' },
];

const VB_W = 720;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
const GRIDLINES = 4;

/** Escolhe até `max` índices igualmente espaçados dentro de `[0, n-1]`. */
function ticksIgualmenteEspacados(n: number, max: number): number[] {
  const count = Math.min(max, n);
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / (count - 1)));
}

export const LineChart: React.FC<LineChartProps> = ({
  series,
  labels,
  height = 260,
  ariaLabel,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const maxValor = useMemo(() => {
    let m = 0;
    for (const s of series) {
      for (const v of s.valores) if (v > m) m = v;
    }
    return m;
  }, [series]);

  const temDados =
    !loading &&
    labels.length > 0 &&
    series.length > 0 &&
    series.some((s) => s.valores.some((v) => v > 0));

  if (loading) {
    return (
      <div className="linechart linechart--state" style={{ minHeight: height }}>
        <p className="linechart-state-text">{t.components.chart.loading}</p>
      </div>
    );
  }

  if (!temDados) {
    return (
      <div className="linechart linechart--state" style={{ minHeight: height }}>
        <p className="linechart-state-text">{t.components.chart.noData}</p>
      </div>
    );
  }

  const n = labels.length;
  const escalaMax = maxValor <= 0 ? 1 : maxValor;
  const xAt = (i: number) =>
    n <= 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (n - 1);
  const yAt = (v: number) => PAD.top + plotH - (v / escalaMax) * plotH;

  const gridlines = Array.from({ length: GRIDLINES + 1 }, (_, k) => {
    const frac = k / GRIDLINES;
    return { y: PAD.top + plotH - frac * plotH, valor: Math.round(frac * escalaMax) };
  });

  const xTicks = ticksIgualmenteEspacados(n, 6);

  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * VB_W;
    if (px < PAD.left || px > PAD.left + plotW) {
      setHover(null);
      return;
    }
    const rel = n <= 1 ? 0 : ((px - PAD.left) / plotW) * (n - 1);
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel))));
  };

  return (
    <div className="linechart" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        className="linechart-svg"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {gridlines.map((g, k) => (
          <g key={k}>
            <line x1={PAD.left} y1={g.y} x2={PAD.left + plotW} y2={g.y} className="linechart-grid" />
            <text
              x={PAD.left - 8}
              y={g.y + 4}
              textAnchor="end"
              className="linechart-axis-label"
            >
              {g.valor}
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + plotH}
          className="linechart-axis"
        />
        <line
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={PAD.left + plotW}
          y2={PAD.top + plotH}
          className="linechart-axis"
        />

        {xTicks.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={height - 8}
            textAnchor="middle"
            className="linechart-axis-label"
          >
            {labels[i]}
          </text>
        ))}

        {hover !== null && (
          <line
            x1={xAt(hover)}
            y1={PAD.top}
            x2={xAt(hover)}
            y2={PAD.top + plotH}
            className="linechart-guide"
          />
        )}

        {series.map((s, si) => {
          const cor = PALETA[si % PALETA.length];
          const pts = s.valores.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
          return (
            <g key={s.nome}>
              <polyline
                points={pts}
                fill="none"
                stroke={cor.stroke}
                strokeWidth={2}
                strokeDasharray={cor.dash}
                className="linechart-line"
              />
              {s.valores.map((v, i) => (
                <circle
                  key={i}
                  cx={xAt(i)}
                  cy={yAt(v)}
                  r={hover === i ? 3.5 : 2}
                  fill={cor.stroke}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div className="linechart-tip" role="status">
          <span className="linechart-tip-dia">{labels[hover]}</span>
          {series.map((s, si) => (
            <span key={s.nome} className="linechart-tip-row">
              <span
                className="linechart-tip-swatch"
                style={{ background: PALETA[si % PALETA.length].stroke }}
                aria-hidden="true"
              />
              {s.nome}: <strong>{s.valores[hover] ?? 0}</strong>
            </span>
          ))}
        </div>
      )}

      <ul className="linechart-legend">
        {series.map((s, si) => {
          const cor = PALETA[si % PALETA.length];
          return (
            <li key={s.nome} className="linechart-legend-item">
              <svg width="22" height="8" aria-hidden="true" className="linechart-legend-mark">
                <line
                  x1="0"
                  y1="4"
                  x2="22"
                  y2="4"
                  stroke={cor.stroke}
                  strokeWidth={2}
                  strokeDasharray={cor.dash}
                />
              </svg>
              <span>{s.nome}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
