import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/DataDisplay';
import { InfoHint } from '../../components/shared/InfoHint';
import { ActionMenu } from '../../components/shared/ActionMenu';
import { Icon } from '../../components/shared/Icon';
import { StatusToggle } from '../../components/shared/StatusToggle';
import { Select } from '../../components/shared/Input';
import { FilterPopover } from '../../components/shared/FilterPopover';
import { ListTableFooter } from '../../components/shared/ListTableFooter';
import { useImoveis, useCidades, usePatchImovel } from '../../api/imoveis';
import { PlenoSyncBadge } from '../../components/shared/PlenoSyncBadge';
import { useTranslation, fmt } from '../../i18n';
import './Properties.css';
import '../../components/shared/ListTable.css';

const PAGE_SIZE = 20;

export const Properties: React.FC = () => {
  const {
    expandedPropertyId, setExpandedPropertyId, propertyFilters, setPropertyFilters,
    setToast,
  } = useAppStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tp = t.properties;
  const patchImovel = usePatchImovel();
  const [page, setPage] = React.useState(0);

  React.useEffect(() => { setPage(0); }, [propertyFilters]);

  const toggleSituacao = async (id: string, ativoAtual: boolean) => {
    try {
      await patchImovel.mutateAsync({ id, ativo: !ativoAtual });
      setToast(!ativoAtual ? tp.activated : tp.deactivated);
    } catch (e: any) {
      setToast(e?.message || tp.statusError);
    }
    setTimeout(() => setToast(null), 3000);
  };

  const { data: propertiesData, isLoading: isLoadingProperties, error: propertiesError, isFetching } = useImoveis({
    ...propertyFilters,
    page,
    size: PAGE_SIZE,
  });
  const { data: cidades = [], isLoading: isLoadingCidades } = useCidades();

  const pageProperties = propertiesData?.content ?? [];
  const totalPages = propertiesData?.totalPages ?? 0;
  const totalElements = propertiesData?.totalElements ?? pageProperties.length;

  React.useEffect(() => {
    if (page > 0 && totalPages > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);

  const tipos = tp.types;
  const situacoes = tp.statuses;

  const activeFilterCount = [propertyFilters.tipo, propertyFilters.cidade, propertyFilters.situacao]
    .filter(Boolean).length;

  const clearFilters = () => setPropertyFilters({ tipo: '', cidade: '', situacao: '' });

  const cidadesList = cidades.map(c => c.nome);

  // GET /v1/imoveis devolve só `cidadeId` — resolvemos o nome pela lista de cidades.
  const cidadeLabel = (prop: { cidade?: string; cidadeId?: string }) => {
    if (prop.cidade) return prop.cidade;
    const c = cidades.find((x) => x.id === prop.cidadeId);
    return c ? (c.uf ? `${c.nome}/${c.uf}` : c.nome) : '—';
  };

  const handleExpandRow = (id: string) => {
    setExpandedPropertyId(expandedPropertyId === id ? null : id);
  };

  const handleNewProperty = () => {
    navigate('/properties/new');
  };

  const handleEditProperty = (id: string) => {
    navigate(`/properties/${id}/edit`);
  };

  return (
    <div className="properties-container">
      <div className="properties-header">
        <div>
          <InfoHint title={t.nav.items.properties}>
            <p>{tp.hintBody}</p>
          </InfoHint>
        </div>
        <div className="properties-header-actions">
          <FilterPopover
            title={tp.filtersTitle}
            activeCount={activeFilterCount}
            onClear={clearFilters}
          >
            <div className="properties-filters">
              <Select
                label={tp.filterType}
                options={tipos}
                value={propertyFilters.tipo || ''}
                onChange={(e) => setPropertyFilters({ tipo: e.target.value })}
              />
              <Select
                label={tp.filterCity}
                options={cidadesList}
                value={propertyFilters.cidade || ''}
                onChange={(e) => setPropertyFilters({ cidade: e.target.value })}
                disabled={isLoadingCidades}
              />
              <Select
                label={tp.filterStatus}
                options={situacoes}
                value={propertyFilters.situacao || ''}
                onChange={(e) => setPropertyFilters({ situacao: e.target.value })}
              />
            </div>
          </FilterPopover>
          <Button variant="accent" size="md" onClick={handleNewProperty}><Icon name="plus" size={14} /> {tp.registerProperty}</Button>
        </div>
      </div>

      <Card>
        <div className="list-table" style={{ ['--list-table-cols' as string]: '2fr 1fr 1fr 1fr' }}>
          <div className="list-table-header">
            <div>{tp.colAddress}</div>
            <div>{tp.colType}</div>
            <div>{tp.colCity}</div>
            <div>{tp.colStatus}</div>
          </div>

          {isLoadingProperties && (
            <div className="list-table-empty">
              <p>{tp.loading}</p>
            </div>
          )}

          {propertiesError && (
            <div className="list-table-empty list-table-empty--erro">
              <p>{tp.loadError}</p>
            </div>
          )}

          {!isLoadingProperties && !propertiesError && propertiesData && (
            <>
              {pageProperties.length > 0 ? (
                pageProperties.map((prop) => (
                  <React.Fragment key={prop.id}>
                    <div
                      className="list-table-row list-table-row--clickable properties-row"
                      onClick={() => handleExpandRow(prop.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpandRow(prop.id); }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expandedPropertyId === prop.id}
                    >
                      <div className="list-table-title">
                        <div className="list-table-name">{prop.endereco}</div>
                      </div>
                      <div className="list-table-col list-table-text" data-label={tp.colType}>{prop.tipo}</div>
                      <div className="list-table-col list-table-text" data-label={tp.colCity}>{cidadeLabel(prop)}</div>
                      <div className="list-table-end list-table-col" data-label={tp.colStatus} onClick={(e) => e.stopPropagation()}>
                        <StatusToggle
                          active={prop.ativo ?? true}
                          onToggle={() => toggleSituacao(prop.id, prop.ativo ?? true)}
                          disabled={patchImovel.isPending}
                          noun={tp.propertyNoun}
                        />
                        <ActionMenu
                          size="sm"
                          trigger={<Icon name="ellipsis-vertical" />}
                          label={fmt(tp.rowActions, { endereco: prop.endereco })}
                          items={[
                            {
                              key: 'edit',
                              label: tp.edit,
                              onClick: () => handleEditProperty(prop.id),
                            },
                            (prop.ativo ?? true)
                              ? {
                                  key: 'off',
                                  label: tp.deactivateProperty,
                                  danger: true,
                                  disabled: patchImovel.isPending,
                                  onClick: () => toggleSituacao(prop.id, true),
                                }
                              : {
                                  key: 'on',
                                  label: tp.activateProperty,
                                  disabled: patchImovel.isPending,
                                  onClick: () => toggleSituacao(prop.id, false),
                                },
                          ]}
                        />
                      </div>
                    </div>

                    {expandedPropertyId === prop.id && (
                      <div className="list-table-detail properties-detail">
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailCode}</span>
                            <p className="detail-value">{prop.id}</p>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailType}</span>
                            <p className="detail-value">{prop.tipo}</p>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailAddress}</span>
                            <p className="detail-value">{prop.endereco}</p>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailCity}</span>
                            <p className="detail-value">{cidadeLabel(prop)}</p>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailArea}</span>
                            <p className="detail-value">{prop.metragem != null ? `${prop.metragem} m²` : (prop.area ?? '—')}</p>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailBedrooms}</span>
                            <p className="detail-value">{prop.dormitorios}</p>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailBathrooms}</span>
                            <p className="detail-value">{prop.banheiros}</p>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailStatus}</span>
                            <p className="detail-value">{(prop.ativo ?? true) ? tp.statusActive : tp.statusInactive}</p>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">{tp.detailPlenoMirror}</span>
                            <p className="detail-value">
                              <PlenoSyncBadge tipo="imovel" id={prop.id} />
                            </p>
                          </div>
                        </div>

                        <div className="detail-footer">
                          <span className="detail-note">{fmt(tp.assignedTo, { vistoriador: prop.vistoriador ?? '—' })}</span>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <div className="list-table-empty">
                  <p>{tp.emptyFiltered}</p>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {!isLoadingProperties && !propertiesError && (
        <ListTableFooter
          shown={pageProperties.length}
          total={totalElements}
          page={page}
          totalPages={totalPages}
          countLabel={fmt(tp.footerCount, { shown: pageProperties.length, total: totalElements })}
          isFetching={isFetching}
          onPage={setPage}
        />
      )}
    </div>
  );
};
