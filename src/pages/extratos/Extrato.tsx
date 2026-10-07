import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card, Badge, Dialog } from '../../components/shared/DataDisplay';
import { Icon } from '../../components/shared/Icon';
import { Table, type TableColumn } from '../../components/shared/Table';
import { useImobiliarias } from '../../api/admin';
import { useExtratoVistorias, type VistoriaExtratoLinha } from '../../api/relatorios';
import type { ExtratoItemStatus } from '../../api/extrato';
import { FaturasPanel } from './FaturasPanel';
import { useTranslation, fmt } from '../../i18n';
import { InfoHint } from '../../components/shared/InfoHint';
import './Extrato.css';

const PAGE_SIZE = 20;

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const currentYearMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const fmtData = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

const STATUS_TONE: Record<ExtratoItemStatus, 'ink' | 'gray' | 'outline' | 'red'> = {
  pendente: 'gray',
  atribuida: 'gray',
  agendada: 'outline',
  em_execucao: 'outline',
  concluida: 'ink',
  cancelada: 'red',
};

const AVULSO = 'Avulso · B2C';

export const Extrato: React.FC = () => {
  const { setToast, role, auth } = useAppStore();
  const { t } = useTranslation();
  const te = t.extrato;
  const navigate = useNavigate();

  const isAdmin = role === 'admin';

  const [mes, setMes] = useState(currentYearMonth);
  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');
  const [imobFiltro, setImobFiltro] = useState('');
  const [page, setPage] = useState(0);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setBusca(buscaInput), 350);
    return () => clearTimeout(id);
  }, [buscaInput]);

  useEffect(() => {
    setPage(0);
  }, [mes, busca, imobFiltro]);

  const imobiliariaId = isAdmin
    ? (imobFiltro || null)
    : auth.imobiliariaId ?? auth.imobiliariaIds?.[0] ?? null;

  const imobiliariasQuery = useImobiliarias({ size: 100 }, { enabled: isAdmin });
  const imobiliarias = imobiliariasQuery.data?.content ?? [];

  const vistorias = useExtratoVistorias({
    mes,
    imobiliariaId: isAdmin ? imobFiltro || null : imobiliariaId,
    nome: busca,
    page,
    size: PAGE_SIZE,
  });

  const itens = vistorias.data?.content ?? [];
  const totalFaturado = vistorias.data?.totalFaturado ?? 0;
  const totalVistorias = vistorias.data?.totalElements ?? 0;
  const totalPages = vistorias.data?.totalPages ?? 0;

  const tc = t.extrato;
  const limparFiltros = () => {
    setBuscaInput('');
    setBusca('');
    setMes(currentYearMonth());
    setImobFiltro('');
  };

  const filtrosAtivos = (mes !== currentYearMonth() ? 1 : 0)
    + (busca.trim() !== '' ? 1 : 0)
    + (isAdmin && imobFiltro !== '' ? 1 : 0);

  const baixarArquivo = (conteudo: string, mime: string, nomeArquivo: string) => {
    const blob = new Blob([conteudo], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (itens.length === 0) {
      setToast(te.exportEmpty);
      return;
    }
    const header = 'imobiliaria,vistoria,tipo,vistoriador,status,criada_em,valor';
    const rows = itens.map((r) => [
      r.imobiliariaNome || AVULSO,
      r.endereco,
      r.tipoServico ?? '',
      r.vistoriador ?? '',
      r.status,
      fmtData(r.criadoEm),
      (r.valor ?? 0).toFixed(2),
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    baixarArquivo([header, ...rows].join('\n'), 'text/csv', `extrato-${mes}.csv`);
    setToast(fmt(te.downloaded, { label: 'CSV' }));
  };

  const nomeImobiliaria = (r: VistoriaExtratoLinha) =>
    r.imobiliariaId ? (r.imobiliariaNome || '—') : AVULSO;

  const colunas: TableColumn<VistoriaExtratoLinha>[] = [
    {
      key: 'imobiliariaNome',
      label: te.colAgencyCol,
      width: '1.2fr',
      render: (r) =>
        r.imobiliariaId ? (
          nomeImobiliaria(r)
        ) : (
          <Badge tone="red">{te.avulsoBadge}</Badge>
        ),
    },
    {
      key: 'endereco',
      label: te.colInspection,
      width: '2fr',
      render: (r) => (
        <div className="extrato-vistoria-cell">
          <span className="extrato-vistoria-endereco">{r.endereco}</span>
          {r.tipoServico && <span className="extrato-vistoria-tipo">{r.tipoServico}</span>}
        </div>
      ),
    },
    { key: 'vistoriador', label: te.colInspector, width: '1.2fr', render: (r) => r.vistoriador ?? '—' },
    {
      key: 'status',
      label: te.colStatus,
      width: '0.9fr',
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] ?? 'gray'}>
          {te.statusLabels[r.status] ?? r.status}
        </Badge>
      ),
    },
    { key: 'criadoEm', label: te.colCreatedAt, width: '0.9fr', render: (r) => fmtData(r.criadoEm) },
    { key: 'valor', label: te.colValue, width: '0.9fr', align: 'right', render: (r) => brl(r.valor ?? 0) },
  ];

  const acoesLinha = (r: VistoriaExtratoLinha) =>
    [
      {
        key: 'sol',
        label: te.actionViewRequest,
        onClick: () => navigate(`/requests/${r.solicitacaoId}`),
      },
      r.laudoId
        ? {
            key: 'laudo',
            label: te.actionViewLaudo,
            onClick: () => navigate(`/laudos?solicitacaoServicoId=${r.id}`),
          }
        : null,
    ].filter((x): x is { key: string; label: string; onClick: () => void } => x !== null);

  const mesLabel = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    if (!y || !m) return mes;
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [mes]);

  return (
    <div className="extrato-container">
      <div className="extrato-header">
        <div>
          <InfoHint title={t.nav.items.extrato}>
            <p>{tc.hintTitle}</p>
            <p>{tc.pageSubtitle}</p>
          </InfoHint>
        </div>
        <div className="extrato-header-actions">
          <Button
            variant="secondary"
            size="md"
            className="extrato-filtrar-btn"
            onClick={() => setFiltrosAbertos(true)}
            aria-label={filtrosAtivos > 0 ? fmt(te.filterButtonCount, { n: filtrosAtivos }) : te.filterButton}
            title={te.filterButton}
          >
            <Icon name="funnel" size={14} /> {te.filterButton}
            {filtrosAtivos > 0 && (
              <span className="extrato-filtro-contador" aria-hidden="true">{filtrosAtivos}</span>
            )}
          </Button>
          <Button variant="primary" size="md" onClick={handleExport}>
            {te.exportButton}
          </Button>
        </div>
      </div>

      <Dialog
        isOpen={filtrosAbertos}
        onClose={() => setFiltrosAbertos(false)}
        title={te.filterModalTitle}
        actions={
          <>
            <Button variant="ghost" size="md" onClick={limparFiltros}>
              {te.clearFilters}
            </Button>
            <Button variant="primary" size="md" onClick={() => setFiltrosAbertos(false)}>
              {te.filterApply}
            </Button>
          </>
        }
      >
        <div className="extrato-filtro-form">
          <div className="extrato-filter-field">
            <label className="extrato-field-label" htmlFor="extrato-mes">{te.monthLabel}</label>
            <input
              id="extrato-mes"
              className="form-input"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value || currentYearMonth())}
              aria-label={te.monthLabel}
            />
          </div>
          <div className="extrato-filter-field">
            <label className="extrato-field-label" htmlFor="extrato-busca">{te.searchNameLabel}</label>
            <input
              id="extrato-busca"
              className="form-input"
              type="search"
              placeholder={te.searchNamePlaceholder}
              aria-label={te.searchNameLabel}
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
            />
          </div>
          {isAdmin && (
            <div className="extrato-filter-field">
              <label className="extrato-field-label" htmlFor="extrato-imob">{te.filterAgency}</label>
              <select
                id="extrato-imob"
                className="form-select"
                aria-label={te.filterAgency}
                value={imobFiltro}
                onChange={(e) => setImobFiltro(e.target.value)}
              >
                <option value="">{te.filterAgencyAll}</option>
                {imobiliarias.map((im) => (
                  <option key={im.id} value={im.id}>{im.nomeFantasia || im.razaoSocial}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Dialog>

      <div className="extrato-kpis">
        <Card className="extrato-kpi">
          <div className="extrato-kpi-label">{te.kpiBilled}</div>
          <div className="extrato-kpi-value">{brl(Number(totalFaturado) || 0)}</div>
        </Card>
        <Card className="extrato-kpi">
          <div className="extrato-kpi-label">{te.kpiCount}</div>
          <div className="extrato-kpi-value">{totalVistorias}</div>
        </Card>
      </div>

      <Card>
        {vistorias.isLoading && <p className="extract-text">{te.loading}</p>}
        {vistorias.error && <p className="extract-text">{te.itemsError}</p>}
        {!vistorias.isLoading && !vistorias.error && (
          <Table<VistoriaExtratoLinha>
            columns={colunas}
            data={itens}
            rowKey={(r) => r.id}
            getActions={acoesLinha}
            emptyMessage={te.itemsEmptyMonth}
          />
        )}
      </Card>

      {imobiliariaId && <FaturasPanel imobiliariaId={imobiliariaId} mes={mes} />}

      {totalPages > 1 && (
        <div className="extrato-paginacao">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            {te.prev}
          </Button>
          <span className="extract-text">{fmt(te.pageOf, { page: page + 1, total: totalPages })}</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {te.next}
          </Button>
        </div>
      )}

      <p className="extrato-month-caption">{fmt(te.filteredMonth, { mes: mesLabel })}</p>
    </div>
  );
};
