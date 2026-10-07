import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, type RequestsView } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card, Badge, Tabs } from '../../components/shared/DataDisplay';
import { Input } from '../../components/shared/Input';
import { FilterPopover } from '../../components/shared/FilterPopover';
import { Icon } from '../../components/shared/Icon';
import { useSolicitacoes, type StatusKey } from '../../api/solicitacoes';
import { useCidades } from '../../api/imoveis';
import { useImobiliarias } from '../../api/admin';
import { statusTone } from '../../utils/statusTone';
import { PlenoSyncBadge } from '../../components/shared/PlenoSyncBadge';
import { RequestsBoard } from './RequestsBoard';
import { PagarCta } from '../../components/shared/PagarCta';
import { useTranslation, fmt } from '../../i18n';
import { InfoHint } from '../../components/shared/InfoHint';
import './Requests.css';

const PAGE_SIZE = 20;

/** Chaves de status: a chave vai para a API, o rótulo vem do i18n. */
const STATUS_KEYS: StatusKey[] = [
  'solicitada',
  'atribuida',
  'agendada',
  'em_campo',
  'concluida',
  'cancelada',
];

export const Requests: React.FC = () => {
  const {
    expandedRequestId,
    setExpandedRequestId,
    requestsView,
    setRequestsView,
    role,
    auth,
  } = useAppStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tr = t.requests;

  // O vistoriador usa /requests como fila (a lista /inspections foi removida).
  // Para esse perfil a tela é só leitura + "Ir para vistoria": nada de criar
  // solicitação, pagar ou navegar para laudos.
  const isVistoriador = role === 'vistoriador';

  const [statusFilter, setStatusFilter] = useState<StatusKey | ''>('');
  const [cidadeFilter, setCidadeFilter] = useState<string | undefined>();
  const [imobiliariaFilter, setImobiliariaFilter] = useState<string | undefined>();
  const [urgenteOnly, setUrgenteOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const board = requestsView === 'board';

  // Escopo de imobiliária (mesma regra do antigo Kanban): admin escolhe qualquer
  // uma (ou todas); 1 vínculo = fixo e sem seletor; >1 = só as permitidas.
  const vinculos = auth.imobiliariaIds ?? [];
  const isAdmin = role === 'admin';
  const mostraPicker = isAdmin || vinculos.length > 1;
  const imobiliariasQuery = useImobiliarias(undefined, { enabled: mostraPicker });
  const opcoesImobiliaria = (imobiliariasQuery.data?.content ?? []).filter(
    (im) => isAdmin || vinculos.includes(im.id),
  );
  const imobiliariaFixa = !isAdmin && vinculos.length === 1 ? vinculos[0] : undefined;
  const imobiliariaId = imobiliariaFixa ?? imobiliariaFilter;

  const tc = t.requests;

  // A busca vai para a API, então espera o usuário parar de digitar antes de consultar.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Qualquer mudança de filtro reinicia a paginação — senão a página 3 de um filtro
  // vira uma página vazia no filtro seguinte.
  useEffect(() => {
    setPage(0);
  }, [statusFilter, cidadeFilter, imobiliariaFilter, urgenteOnly, search]);

  const { data, isLoading, error, isFetching } = useSolicitacoes({
    q: search,
    cidadeId: cidadeFilter,
    imobiliariaId,
    urgente: urgenteOnly || undefined,
    status: statusFilter,
    page,
    size: PAGE_SIZE,
    enabled: !board, // no modo board, a lista paginada não é consultada
  });

  const cidades = useCidades().data ?? [];
  const requests = data?.content ?? [];

  // Só conta filtros que estão VISÍVEIS no modo atual (cidade/urgência somem no board).
  const filtrosAtivos = (
    board
      ? [statusFilter, imobiliariaFilter]
      : [statusFilter, cidadeFilter, imobiliariaFilter, urgenteOnly || undefined]
  ).filter(Boolean).length + (search.trim() ? 1 : 0);

  const limparFiltros = () => {
    setStatusFilter('');
    setCidadeFilter(undefined);
    setImobiliariaFilter(undefined);
    setUrgenteOnly(false);
    setSearchInput('');
    setSearch('');
  };

  const handleExpandRequest = (id: string) => {
    setExpandedRequestId(expandedRequestId === id ? null : id);
  };

  const abrirDetalhe = (solicitacaoId: string) => {
    navigate(`/inspections/${solicitacaoId}`);
  };

  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="requests-container">
      <div className="requests-header">
        <div>
          <InfoHint title={t.nav.items.requests}>
            <p>{tc.subtitle}</p>
          </InfoHint>
        </div>
        <div className="requests-header-actions">
          <FilterPopover activeCount={filtrosAtivos} onClear={limparFiltros}>
            <div className="filter-group">
              <span className="filter-group-label">{tr.filterSearch}</span>
              <Input
                placeholder={tr.searchPlaceholder}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <span className="filter-group-label">{tr.filterStatus}</span>
              <div className="filter-group-chips">
                <button
                  className={`filter-chip ${!statusFilter ? 'filter-chip--active' : ''}`}
                  onClick={() => setStatusFilter('')}
                >
                  {tr.filterAll}
                </button>
                {STATUS_KEYS.map((key) => (
                  <button
                    key={key}
                    className={`filter-chip ${statusFilter === key ? 'filter-chip--active' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                  >
                    {tr.statusLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            {mostraPicker && (
              <div className="filter-group">
                <span className="filter-group-label">{tr.filterAgency}</span>
                <select
                  className="filter-select"
                  aria-label={tr.filterAgency}
                  value={imobiliariaFilter ?? ''}
                  onChange={(e) =>
                    setImobiliariaFilter(e.target.value ? e.target.value : undefined)
                  }
                >
                  <option value="">{isAdmin ? tr.agencyAllAdmin : tr.agencyAllMine}</option>
                  {opcoesImobiliaria.map((im) => (
                    <option key={im.id} value={im.id}>
                      {im.nomeFantasia || im.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!board && (
              <div className="filter-group">
                <span className="filter-group-label">{tr.filterCity}</span>
                <select
                  className="filter-select"
                  aria-label={tr.filterCity}
                  value={cidadeFilter ?? ''}
                  onChange={(e) =>
                    setCidadeFilter(e.target.value ? e.target.value : undefined)
                  }
                >
                  <option value="">{tr.cityAll}</option>
                  {cidades.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}/{c.uf}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!board && (
              <div className="filter-group">
                <span className="filter-group-label">{tr.filterPriority}</span>
                <div className="filter-group-chips">
                  <button
                    className={`filter-chip ${urgenteOnly ? 'filter-chip--active' : ''}`}
                    onClick={() => setUrgenteOnly((v) => !v)}
                  >
                    {tr.urgentOnly}
                  </button>
                </div>
              </div>
            )}
          </FilterPopover>
          {!isVistoriador && (
            <Button variant="accent" size="md" onClick={() => navigate('/requests/new')}>
              <Icon name="plus" size={14} /> {t.nav.items.requestsNew}
            </Button>
          )}
        </div>
      </div>

      <Tabs
        className="requests-view-tabs"
        tabs={[
          { id: 'lista', label: tr.viewList },
          { id: 'board', label: tr.viewBoard },
        ]}
        activeTab={requestsView}
        onTabChange={(id) => setRequestsView(id as RequestsView)}
      />

      {board ? (
        <RequestsBoard imobiliariaId={imobiliariaId} search={search} statusFilter={statusFilter} />
      ) : (
        <>
          <Card>
            <div className="requests-table">
              <div className="table-header">
                <div className="col-title">{tr.colRequest}</div>
                <div className="col-2">{tr.colTypeInspector}</div>
                <div className="col-3">{tr.colDateTime}</div>
                <div className="col-4">{tr.colValue}</div>
              </div>

              {isLoading && (
                <div className="table-empty">
                  <p>{tr.loadingRequests}</p>
                </div>
              )}

              {error && (
                <div className="table-empty" style={{ color: 'var(--mv-brand-primary)' }}>
                  <p>{tr.loadRequestsError}</p>
                </div>
              )}

              {!isLoading && !error && requests.length > 0
                ? requests.map((req) => (
                    <div key={req.id}>
                      <div className="table-row" onClick={() => handleExpandRequest(req.id)}>
                        <div className="col-title">
                          <div className="row-title">
                            {req.id}
                            {req.urgente && <span className="row-urgent">{tr.urgentTag}</span>}
                          </div>
                          <div className="row-subtitle">{req.endereco}</div>
                        </div>
                        <div className="col-2">
                          <span className="row-text">
                            {req.tipo} · {req.vistoriador}
                          </span>
                        </div>
                        <div className="col-3">
                          <span className="row-text">
                            {req.data} · {req.hora}
                          </span>
                        </div>
                        <div className="col-4">
                          <Badge tone={statusTone(req.status)}>{req.status}</Badge>
                          {/* Só ícone: o rótulo textual saiu a pedido do produto. */}
                          <span
                            className={`chevron ${expandedRequestId === req.id ? 'chevron--open' : ''}`}
                            role="img"
                            aria-label={
                              expandedRequestId === req.id ? tr.closeDetails : tr.openDetails
                            }
                            title={expandedRequestId === req.id ? tr.closeDetails : tr.openDetails}
                          >
                            <Icon name={expandedRequestId === req.id ? 'chevron-up' : 'chevron-down'} size={14} />
                          </span>
                        </div>
                      </div>

                      {expandedRequestId === req.id && (
                        <div className="table-detail">
                          <div className="detail-grid">
                            <div className="detail-cell">
                              <span className="detail-label">{tr.detailCity}</span>
                              <span className="detail-value">{req.imagem}</span>
                            </div>
                            <div className="detail-cell">
                              <span className="detail-label">{tr.detailServiceType}</span>
                              <span className="detail-value">{req.tipo}</span>
                            </div>
                            <div className="detail-cell">
                              <span className="detail-label">{tr.detailInspector}</span>
                              <span className="detail-value">{req.vistoriador}</span>
                            </div>
                            {req.valor != null && (
                              <div className="detail-cell">
                                <span className="detail-label">{tr.detailValue}</span>
                                <span className="detail-value">{req.valor}</span>
                              </div>
                            )}
                            <div className="detail-cell">
                              <span className="detail-label">{tr.detailPlenoMirror}</span>
                              <span className="detail-value">
                                <PlenoSyncBadge tipo="solicitacao" id={req.solicitacaoId} />
                              </span>
                            </div>
                          </div>
                          <div className="detail-actions">
                            {!isVistoriador && (
                              <PagarCta
                                solicitacaoId={req.solicitacaoId}
                                checkoutUrl={req.checkoutUrl}
                                paymentStatus={req.paymentStatus}
                              />
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => abrirDetalhe(req.solicitacaoId)}
                            >
                              {isVistoriador ? tr.goToInspection : tr.viewDetail}
                            </Button>
                            {!isVistoriador && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  navigate('/laudos');
                                }}
                              >
                                {tr.viewLaudos}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                : !isLoading &&
                  !error && (
                    <div className="table-empty">
                      <p>{tr.noneFound}</p>
                      {!isVistoriador && (
                        <Button size="sm" variant="secondary" onClick={() => navigate('/requests/new')}>
                          {tr.createFirst}
                        </Button>
                      )}
                    </div>
                  )}
            </div>
          </Card>

          <div className="requests-footer">
            <span className="footer-text">
              {fmt(tr.footerCount, { shown: requests.length, total: data?.totalElements ?? 0 })}
              {totalPages > 1 && fmt(tr.footerPage, { page: page + 1, total: totalPages })}
            </span>
            <div className="footer-actions">
              <Button
                size="sm"
                variant="ghost"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <Icon name="chevron-left" size={14} /> {tr.prev}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={data?.last !== false || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                {tr.next} <Icon name="chevron-right" size={14} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
