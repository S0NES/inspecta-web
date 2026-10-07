import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/shared/DataDisplay';
import { Input, Select } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { useImobiliarias, useUpdateImobiliaria } from '../../api/admin';
import { useAppStore } from '../../store/useAppStore';
import { InfoHint } from '../../components/shared/InfoHint';
import { FilterPopover } from '../../components/shared/FilterPopover';
import { ListTableFooter } from '../../components/shared/ListTableFooter';
import { PlenoSyncBadge } from '../../components/shared/PlenoSyncBadge';
import { ActionMenu } from '../../components/shared/ActionMenu';
import { Icon } from '../../components/shared/Icon';
import { StatusToggle } from '../../components/shared/StatusToggle';
import { useTranslation, fmt } from '../../i18n';
import './Admin.css';
import '../../components/shared/ListTable.css';

const PAGE_SIZE = 20;

/**
 * Real Estate — cadastro das imobiliárias parceiras (listar/criar/editar/(des)ativar). Vistoriadores,
 * usuários da imobiliária (gerência/operação) e cidades têm telas próprias: `Usuários`
 * (`/usuarios`), `Vistoriadores` (embutida ali quando aplicável) e `Cidades` (`/cities`).
 */
export const Admin: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tg = t.agencies;
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(tg.filterAll);
  const [expandedAgencyId, setExpandedAgencyId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  React.useEffect(() => { setPage(0); }, [search, statusFilter]);

  const { data: imobiliariasData, isLoading, error, isFetching } = useImobiliarias({
    page,
    size: PAGE_SIZE,
  });
  const updateImobiliaria = useUpdateImobiliaria();

  const agencias = imobiliariasData?.content || [];

  const toggleImobiliaria = async (id: string, ativa: boolean) => {
    try {
      await updateImobiliaria.mutateAsync({ id, ativa: !ativa });
      setToast(!ativa ? tg.activated : tg.deactivated);
    } catch (e: any) { setToast(e?.message || tg.updateError); }
    setTimeout(() => setToast(null), 3000);
  };

  const agenciasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agencias.filter((a) => {
      const combinaBusca =
        !q || a.razaoSocial.toLowerCase().includes(q) || (a.nomeFantasia ?? '').toLowerCase().includes(q);
      const combinaStatus =
        statusFilter === tg.filterAll || (statusFilter === tg.filterActive) === a.ativa;
      return combinaBusca && combinaStatus;
    });
  }, [agencias, search, statusFilter, tg.filterAll, tg.filterActive]);

  const totalPages = imobiliariasData?.totalPages ?? 0;

  React.useEffect(() => {
    if (page > 0 && totalPages > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);

  const handleEditAgency = (id: string) => {
    navigate(`/agencies/${id}/edit`);
  };

  const renderAgenciesTable = () => (
    <div className="list-table" style={{ ['--list-table-cols' as string]: '2fr 1.5fr 1fr' }}>
      <div className="list-table-header">
        <div>{tg.colName}</div>
        <div>{tg.colCnpj}</div>
        <div>{tg.colStatus}</div>
      </div>
      {agenciasFiltradas.map((agency) => (
        <React.Fragment key={agency.id}>
        <div
          className="list-table-row list-table-row--clickable admin-row admin-row--clickable"
          onClick={() => setExpandedAgencyId(expandedAgencyId === agency.id ? null : agency.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpandedAgencyId(expandedAgencyId === agency.id ? null : agency.id);
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={expandedAgencyId === agency.id}
        >
          <div className="list-table-title">
            <div className="list-table-title-row">
              <div className="list-table-name">{agency.razaoSocial}</div>
              <PlenoSyncBadge tipo="imobiliaria" id={agency.id} poll={false} />
            </div>
            {agency.nomeFantasia && (
              <div className="list-table-sub">{agency.nomeFantasia}</div>
            )}
          </div>
          <div className="list-table-col list-table-text" data-label={tg.colCnpj}>{agency.cnpj}</div>
          <div className="list-table-end list-table-col" data-label={tg.colStatus} onClick={(e) => e.stopPropagation()}>
            <StatusToggle
              active={agency.ativa}
              onToggle={() => toggleImobiliaria(agency.id, agency.ativa)}
              disabled={updateImobiliaria.isPending}
              noun={tg.noun}
            />
            <ActionMenu
              size="sm"
              trigger={<Icon name="ellipsis-vertical" />}
              label={fmt(tg.rowActions, { nome: agency.razaoSocial })}
              items={[
                {
                  key: 'edit',
                  label: tg.edit,
                  onClick: () => handleEditAgency(agency.id),
                },
                agency.ativa
                  ? {
                      key: 'off',
                      label: tg.deactivate,
                      danger: true,
                      disabled: updateImobiliaria.isPending,
                      onClick: () => toggleImobiliaria(agency.id, true),
                    }
                  : {
                      key: 'on',
                      label: tg.activate,
                      disabled: updateImobiliaria.isPending,
                      onClick: () => toggleImobiliaria(agency.id, false),
                    },
              ]}
            />
          </div>
        </div>
        {expandedAgencyId === agency.id && (
          <div className="list-table-detail">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">{tg.detailRazaoSocial}</span>
                <p className="detail-value">{agency.razaoSocial}</p>
              </div>
              <div className="detail-item">
                <span className="detail-label">{tg.detailNomeFantasia}</span>
                <p className="detail-value">{agency.nomeFantasia || '—'}</p>
              </div>
              <div className="detail-item">
                <span className="detail-label">{tg.detailCnpj}</span>
                <p className="detail-value">{agency.cnpj}</p>
              </div>
              <div className="detail-item">
                <span className="detail-label">{tg.detailPhone}</span>
                <p className="detail-value">{agency.telefone || '—'}</p>
              </div>
              <div className="detail-item">
                <span className="detail-label">{tg.detailFinanceEmail}</span>
                <p className="detail-value">{agency.emailFinanceiro || '—'}</p>
              </div>
              <div className="detail-item">
                <span className="detail-label">{tg.detailPix}</span>
                <p className="detail-value">{agency.pix || '—'}</p>
              </div>
              <div className="detail-item">
                <span className="detail-label">{tg.detailStatus}</span>
                <p className="detail-value">{agency.ativa ? tg.statusActive : tg.statusInactive}</p>
              </div>
              <div className="detail-item">
                <span className="detail-label">{tg.detailPlenoMirror}</span>
                <p className="detail-value">
                  <PlenoSyncBadge tipo="imobiliaria" id={agency.id} />
                </p>
              </div>
            </div>
          </div>
        )}
        </React.Fragment>
      ))}
      {agenciasFiltradas.length === 0 && (
        <div className="list-table-empty">
          {agencias.length === 0 ? tg.emptyNone : tg.emptyFiltered}
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-container">
      <div className="admin-header-section">
        <div className="admin-title">
          <InfoHint title={t.nav.items.agencies}>
            <p>
              {tg.hintP1Prefix}<strong>{tg.hintP1Bold}</strong>{tg.hintP1Mid}<em>{tg.hintP1Em}</em>{tg.hintP1Suffix}
            </p>
            <p>{tg.hintP2}</p>
          </InfoHint>
        </div>
        <div className="admin-header-right">
          <FilterPopover
            activeCount={(search.trim() ? 1 : 0) + (statusFilter !== tg.filterAll ? 1 : 0)}
            onClear={() => {
              setSearch('');
              setStatusFilter(tg.filterAll);
            }}
          >
            <Input
              label={tg.filterName}
              placeholder={tg.searchPlaceholder}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              label={tg.filterStatusAria}
              options={[tg.filterAll, tg.filterActive, tg.filterInactive]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value || tg.filterAll)}
            />
          </FilterPopover>
          <Button variant="accent" size="md" onClick={() => navigate('/agencies/new')}>
            <Icon name="plus" size={14} /> {tg.newAgency}
          </Button>
        </div>
      </div>

      <Card>
        {isLoading && <div className="list-table-empty">{tg.loading}</div>}
        {error && <div className="list-table-empty list-table-empty--erro">{tg.loadError}</div>}
        {!isLoading && !error && renderAgenciesTable()}
      </Card>

      {!isLoading && !error && (
        <ListTableFooter
          shown={agenciasFiltradas.length}
          total={imobiliariasData?.totalElements ?? agenciasFiltradas.length}
          page={page}
          totalPages={totalPages}
          countLabel={fmt(tg.footerCount, {
            shown: agenciasFiltradas.length,
            total: imobiliariasData?.totalElements ?? agenciasFiltradas.length,
          })}
          isFetching={isFetching}
          onPage={setPage}
        />
      )}
    </div>
  );
};
