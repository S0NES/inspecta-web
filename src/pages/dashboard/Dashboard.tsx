import React, { useMemo, useState } from 'react';
import { Card, Badge, Dialog } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { useNavigate } from 'react-router-dom';
import { LineChart, type LineChartSerie } from '../../components/shared/LineChart';
import { Icon } from '../../components/shared/Icon';
import { useAppStore } from '../../store/useAppStore';
import { useSolicitacoes, useSolicitacoesResumo } from '../../api/solicitacoes';
import {
  useMetricasEnvios,
  useMetricasSolicitacoes,
  type EnviosResponse,
  type SolicitacoesResponse,
} from '../../api/metrics';
import { statusTone } from '../../utils/statusTone';
import { useTranslation, fmt } from '../../i18n';
import './Dashboard.css';

/** Cartões de métrica do painel, na ordem em que o fluxo de trabalho acontece. */
const METRICA_KEYS = ['solicitada', 'agendada', 'em_campo', 'concluida'] as const;

const fmtNum = (n: number) => n.toLocaleString('pt-BR');

/** `2026-08-01` → `01/08`. */
function fmtDia(iso: string): string {
  const [, m, d] = iso.split('-');
  return d && m ? `${d}/${m}` : iso;
}

/** Dias distintos presentes nos buckets, em ordem crescente. */
function diasOrdenados(dias: Array<string | null>): string[] {
  return Array.from(new Set(dias.filter((d): d is string => !!d))).sort();
}

/**
 * Envios: uma série por `tipoEnvio`, somando `criados` sobre `tipoComunicacao`,
 * com 0-fill dos dias sem registro.
 */
function serieEnvios(resp: EnviosResponse | undefined): {
  series: LineChartSerie[];
  labels: string[];
} {
  const buckets = resp?.buckets ?? [];
  const dias = diasOrdenados(buckets.map((b) => b.dia));
  const idx = new Map(dias.map((d, i) => [d, i]));
  const tipos = Array.from(
    new Set(buckets.map((b) => b.tipoEnvio).filter((t): t is string => !!t))
  ).sort();

  const series = tipos.map((tipo) => {
    const valores = new Array(dias.length).fill(0);
    for (const b of buckets) {
      if (b.tipoEnvio === tipo && b.dia) valores[idx.get(b.dia)!] += b.criados;
    }
    return { nome: tipo, valores };
  });

  return { series, labels: dias.map(fmtDia) };
}

/**
 * Solicitações: uma série por `tipoServicoNome` para a métrica escolhida
 * (`concluidas` ou `emAndamento`), com 0-fill dos dias sem registro.
 */
function serieSolicitacoes(
  resp: SolicitacoesResponse | undefined,
  campo: 'concluidas' | 'emAndamento'
): { series: LineChartSerie[]; labels: string[] } {
  const buckets = resp?.buckets ?? [];
  const dias = diasOrdenados(buckets.map((b) => b.dia));
  const idx = new Map(dias.map((d, i) => [d, i]));
  const nomes = Array.from(new Set(buckets.map((b) => b.tipoServicoNome))).sort();

  const series = nomes.map((nome) => {
    const valores = new Array(dias.length).fill(0);
    for (const b of buckets) {
      if (b.tipoServicoNome === nome && b.dia) valores[idx.get(b.dia)!] += b[campo];
    }
    return { nome, valores };
  });

  return { series, labels: dias.map(fmtDia) };
}

export const Dashboard: React.FC = () => {
  const { auth, role } = useAppStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const td = t.dashboard;

  const saudacao = (hora: number): string =>
    hora < 12 ? td.greetingMorning : hora < 18 ? td.greetingAfternoon : td.greetingEvening;

  // admin + suporte colapsam em 'admin' no roleMapper — os dois veem as métricas de staff.
  const isStaff = role === 'admin';

  const [enviosOpen, setEnviosOpen] = useState(false);
  const [solicOpen, setSolicOpen] = useState(false);

  const resumoQuery = useSolicitacoesResumo();
  const filaQuery = useSolicitacoes({ size: 5 });

  // As consultas de métricas só rodam com o modal aberto (e só para staff).
  const enviosQuery = useMetricasEnvios({ enabled: isStaff && enviosOpen });
  const solicMetricasQuery = useMetricasSolicitacoes({ enabled: isStaff && solicOpen });

  const resumo = resumoQuery.data;
  const fila = filaQuery.data?.content ?? [];

  const enviosChart = useMemo(() => serieEnvios(enviosQuery.data), [enviosQuery.data]);
  const solicConcluidas = useMemo(
    () => serieSolicitacoes(solicMetricasQuery.data, 'concluidas'),
    [solicMetricasQuery.data]
  );
  const solicEmAndamento = useMemo(
    () => serieSolicitacoes(solicMetricasQuery.data, 'emAndamento'),
    [solicMetricasQuery.data]
  );

  const enviosTotal = enviosQuery.data ? fmtNum(enviosQuery.data.totais.criados) : '—';
  const solicTotal = solicMetricasQuery.data
    ? fmtNum(
        solicMetricasQuery.data.buckets.reduce(
          (acc, b) => acc + b.concluidas + b.emAndamento,
          0
        )
      )
    : '—';

  // Prioriza o nome real (GET /v1/usuarios/me, ver App.tsx) — só a primeira palavra
  // ("Julio Cesar" -> "Julio"). Sem nome ainda carregado, cai no prefixo do e-mail
  // (heurística antiga) até o `/me` resolver.
  const primeiroNome = auth.userName?.trim()
    ? auth.userName.trim().split(/\s+/)[0]
    : (auth.userEmail ?? '')
        .split('@')[0]
        .split(/[._-]/)[0]
        .replace(/^./, (c) => c.toUpperCase());

  const isCliente = role === 'cliente';
  const novaSolicitacaoTo = isCliente ? '/solicitar' : '/requests/new';
  const novaSolicitacaoLabel = isCliente ? t.nav.items.solicitar : t.nav.items.requestsNew;

  const urgentes = fila.filter((s) => s.urgente);

  const abrir = (setter: (v: boolean) => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setter(true);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="type-h1-page">
            {saudacao(new Date().getHours())}
            {primeiroNome ? fmt(td.greetingName, { nome: primeiroNome }) : ''}
          </h1>
          <p className="dashboard-subtitle">{td.subtitle}</p>
        </div>
        {/* Vistoriador não abre solicitação — e o Wizard dispara GET /v1/imoveis, que o perfil
            não pode listar (403 poluindo o console, RELATORIO.md achado #9). */}
        {role !== 'vistoriador' && (
          <Button variant="accent" size="md" onClick={() => navigate(novaSolicitacaoTo)}>
            <Icon name="plus" size={14} /> {novaSolicitacaoLabel}
          </Button>
        )}
      </div>

      <div className="metrics-grid">
        {METRICA_KEYS.map((key) => (
          <Card key={key}>
            <div className="metric-item">
              <p className="metric-label">{td.metrics[key]}</p>
              <p className="metric-value">
                {resumoQuery.isLoading ? '—' : (resumo?.[key] ?? 0)}
              </p>
              <p className="metric-change">
                {resumo?.total ? fmt(td.metricOfTotal, { total: resumo.total }) : td.metricNoRequests}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {isStaff && (
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="type-h3">{td.sendMetricsTitle}</h2>
            <span className="section-count">{td.last30Days}</span>
          </div>
          <div className="staff-metrics-grid">
            <Card>
              <div
                className="staff-metric"
                role="button"
                tabIndex={0}
                onClick={() => setEnviosOpen(true)}
                onKeyDown={abrir(setEnviosOpen)}
              >
                <p className="metric-label">{td.sendsLabel}</p>
                <p className="metric-value">{enviosTotal}</p>
                <p className="metric-change">{td.sendsChange}</p>
              </div>
            </Card>
            <Card>
              <div
                className="staff-metric"
                role="button"
                tabIndex={0}
                onClick={() => setSolicOpen(true)}
                onKeyDown={abrir(setSolicOpen)}
              >
                <p className="metric-label">{td.requestsLabel}</p>
                <p className="metric-value">{solicTotal}</p>
                <p className="metric-change">{td.requestsChange}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <div className="section-header">
          <h2 className="type-h3">{td.workQueue}</h2>
          <span className="section-count">
            {fmt(td.queueCount, { n: filaQuery.data?.totalElements ?? 0 })}
          </span>
        </div>
        <Card>
          <div className="queue-table">
            <div className="queue-header">
              <div className="queue-col-1">{td.colRequest}</div>
              <div className="queue-col-2">{td.colInspector}</div>
              <div className="queue-col-3">{td.colDateTime}</div>
              <div className="queue-col-4">{td.colStatus}</div>
            </div>

            {filaQuery.isLoading && (
              <div className="queue-empty">
                <p>{td.loadingRequests}</p>
              </div>
            )}

            {filaQuery.error && (
              <div className="queue-empty" style={{ color: 'var(--mv-brand-primary)' }}>
                <p>{td.loadRequestsError}</p>
              </div>
            )}

            {!filaQuery.isLoading && !filaQuery.error && fila.length === 0 && (
              <div className="queue-empty">
                <p>{td.emptyQueue}</p>
                <Button size="sm" variant="secondary" onClick={() => navigate(novaSolicitacaoTo)}>
                  {td.createFirst}
                </Button>
              </div>
            )}

            {fila.map((req) => (
              <div
                key={req.id}
                className="queue-row"
                onClick={() => navigate('/requests')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate('/requests');
                }}
              >
                <div className="queue-col-1">
                  <div className="queue-title">
                    {req.id}
                    {req.urgente && <span className="queue-urgent">{td.urgentTag}</span>}
                  </div>
                  <div className="queue-subtitle">{req.endereco}</div>
                </div>
                <div className="queue-col-2">
                  <p className="queue-text">{req.vistoriador}</p>
                </div>
                <div className="queue-col-3">
                  <p className="queue-text">
                    {req.data} · {req.hora}
                  </p>
                </div>
                <div className="queue-col-4">
                  <Badge tone={statusTone(req.status)}>{req.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {urgentes.length > 0 && (
        <div className="dashboard-section">
          <h2 className="type-h3">{td.slaTitle}</h2>
          <Card>
            {urgentes.map((s) => (
              <div key={s.id} className="sla-item">
                <div className="sla-info">
                  <span className="sla-label">{td.markedUrgent}</span>
                  <p className="sla-value">
                    {s.id} · {s.endereco}
                  </p>
                </div>
                <Badge tone="red">{td.attention}</Badge>
              </div>
            ))}
          </Card>
        </div>
      )}

      {isStaff && (
        <>
          <Dialog
            isOpen={enviosOpen}
            onClose={() => setEnviosOpen(false)}
            size="lg"
            title={td.sendsDialogTitle}
          >
            <LineChart
              series={enviosChart.series}
              labels={enviosChart.labels}
              ariaLabel={td.sendsChartAria}
              loading={enviosQuery.isLoading}
            />
          </Dialog>

          <Dialog
            isOpen={solicOpen}
            onClose={() => setSolicOpen(false)}
            size="lg"
            title={td.requestsDialogTitle}
          >
            <div className="dashboard-chart-group">
              <div className="dashboard-chart">
                <h3 className="type-title">{td.concluded}</h3>
                <LineChart
                  series={solicConcluidas.series}
                  labels={solicConcluidas.labels}
                  ariaLabel={td.concludedChartAria}
                  loading={solicMetricasQuery.isLoading}
                />
              </div>
              <div className="dashboard-chart">
                <h3 className="type-title">{td.inProgress}</h3>
                <LineChart
                  series={solicEmAndamento.series}
                  labels={solicEmAndamento.labels}
                  ariaLabel={td.inProgressChartAria}
                  loading={solicMetricasQuery.isLoading}
                />
              </div>
            </div>
          </Dialog>
        </>
      )}
    </div>
  );
};
