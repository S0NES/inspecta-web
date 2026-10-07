import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge } from '../../components/shared/DataDisplay';
import { Input, Select } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { InfoHint } from '../../components/shared/InfoHint';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { ActionMenu } from '../../components/shared/ActionMenu';
import { FilterPopover } from '../../components/shared/FilterPopover';
import { ListTableFooter } from '../../components/shared/ListTableFooter';
import { Icon } from '../../components/shared/Icon';
import {
  useClientesB2c,
  useInativarClienteB2c,
  type ClienteB2c,
  type ClienteB2cStatus,
} from '../../api/clientesB2c';
import { useResendInvite } from '../../api/admin';
import { useCidades } from '../../api/imoveis';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation, fmt } from '../../i18n';
import './Clientes.css';
import '../../components/shared/ListTable.css';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<ClienteB2cStatus, 'ink' | 'gray' | 'outline'> = {
  ativo: 'ink',
  inativo: 'gray',
  convidado: 'outline',
};

/**
 * Clientes — cadastro dos clientes B2C (pessoas físicas que solicitam vistorias por conta
 * própria, sem vínculo com uma imobiliária parceira). ADMIN/SUPORTE — mesma visibilidade
 * de Imobiliaria/Usuários.
 */
export const Clientes: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tcl = t.clientes;
  const STATUS_LABEL = tcl.statusLabels as Record<ClienteB2cStatus, string>;
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [cidadeFilter, setCidadeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClienteB2cStatus | ''>('');
  const [page, setPage] = useState(0);
  const [pendenteInativar, setPendenteInativar] = useState<ClienteB2c | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => { setPage(0); }, [search, cidadeFilter, statusFilter]);

  const { data: cidades = [] } = useCidades();
  const { data, isLoading, error, isFetching } = useClientesB2c({
    page,
    size: PAGE_SIZE,
    q: search.trim() || undefined,
    cidadeId: cidadeFilter || undefined,
    status: statusFilter || undefined,
  });
  const inativar = useInativarClienteB2c();
  const resend = useResendInvite();

  const clientes = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const filtrosAtivos =
    (search.trim() ? 1 : 0) + (cidadeFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  useEffect(() => {
    if (page > 0 && totalPages > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);

  const toast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  };

  const confirmarInativar = async () => {
    if (!pendenteInativar) return;
    try {
      await inativar.mutateAsync(pendenteInativar.id);
      toast(tcl.deactivated);
    } catch (e) {
      toast(e instanceof Error ? e.message : tcl.deactivateError);
    } finally {
      setPendenteInativar(null);
    }
  };

  const reenviarConvite = async (c: ClienteB2c) => {
    setResendingId(c.id);
    try {
      await resend.mutateAsync(c.usuarioId);
      toast(fmt(tcl.inviteResent, { email: c.email }));
    } catch (e) {
      toast(e instanceof Error ? e.message : tcl.inviteResendError);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="clientes-container">
      <div className="clientes-header">
        <div className="clientes-title">
          <InfoHint title={t.nav.items.clientes}>
            <p>{tcl.hintP1}</p>
            <p>{tcl.hintP2}</p>
          </InfoHint>
        </div>
        <div className="clientes-header-actions">
          <FilterPopover
            activeCount={filtrosAtivos}
            onClear={() => {
              setSearchInput('');
              setSearch('');
              setCidadeFilter('');
              setStatusFilter('');
            }}
          >
            <Input
              label={tcl.filterBySearch}
              placeholder={tcl.searchPlaceholder}
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <div className="form-group">
              <label className="form-label" htmlFor="clientes-filtro-cidade">{tcl.filterByCity}</label>
              <select
                id="clientes-filtro-cidade"
                className="form-select"
                value={cidadeFilter}
                onChange={(e) => setCidadeFilter(e.target.value)}
              >
                <option value="">{tcl.filterAll}</option>
                {cidades.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}/{c.uf}</option>
                ))}
              </select>
            </div>
            <Select
              label={tcl.filterByStatus}
              options={[tcl.filterAll, tcl.statusFilterActive, tcl.statusFilterInactive, tcl.statusFilterInvited]}
              value={statusFilter ? STATUS_LABEL[statusFilter] : tcl.filterAll}
              onChange={(e) => {
                const label = e.target.value;
                const status = (Object.keys(STATUS_LABEL) as ClienteB2cStatus[])
                  .find((s) => STATUS_LABEL[s] === label);
                setStatusFilter(status ?? '');
              }}
            />
          </FilterPopover>
          <Button variant="accent" size="md" onClick={() => navigate('/clientes/new')}>
            <Icon name="plus" size={14} /> {tcl.newClient}
          </Button>
        </div>
      </div>

      <Card>
        <div className="list-table" style={{ ['--list-table-cols' as string]: '2fr 2fr 1fr 32px' }}>
          <div className="list-table-header">
            <span>{tcl.colName}</span>
            <span>{tcl.colEmail}</span>
            <span>{tcl.colInspections}</span>
            <span />
          </div>

          {isLoading && (
            <div className="list-table-empty">
              <p>{tcl.loading}</p>
            </div>
          )}
          {error && (
            <div className="list-table-empty list-table-empty--erro">
              <p>{tcl.loadError}</p>
            </div>
          )}

          {!isLoading && !error && clientes.map((c) => {
            const menuItems = [
              { key: 'edit', label: tcl.edit, onClick: () => navigate(`/clientes/${c.id}/edit`) },
              ...(c.status === 'convidado'
                ? [{
                    key: 'resend',
                    label: tcl.resendInvite,
                    disabled: resendingId === c.id,
                    onClick: () => void reenviarConvite(c),
                  }]
                : []),
              ...(c.status !== 'inativo'
                ? [{ key: 'off', label: tcl.deactivate, danger: true, onClick: () => setPendenteInativar(c) }]
                : []),
            ];
            return (
              <div key={c.id} className="list-table-row clientes-row">
                <span className="list-table-identity">
                  <span className="list-table-identity-text">
                    <span className="list-table-name">
                      {c.nome}
                      {c.status !== 'ativo' && (
                        <Badge tone={STATUS_TONE[c.status]} className="clientes-status-badge">
                          {STATUS_LABEL[c.status]}
                        </Badge>
                      )}
                    </span>
                  </span>
                </span>
                <span className="list-table-col list-table-text" data-label={tcl.colEmail}>{c.email}</span>
                <span className="list-table-col list-table-text" data-label={tcl.colInspections}>{c.quantidadeVistorias}</span>
                <span className="list-table-end clientes-acoes">
                  <ActionMenu
                    size="sm"
                    trigger={<Icon name="ellipsis-vertical" />}
                    label={fmt(tcl.rowActions, { nome: c.nome })}
                    items={menuItems}
                  />
                </span>
              </div>
            );
          })}

          {!isLoading && !error && clientes.length === 0 && (
            <div className="list-table-empty">
              {filtrosAtivos > 0 ? tcl.emptyFiltered : tcl.emptyNone}
            </div>
          )}
        </div>
      </Card>

      {!isLoading && !error && (
        <ListTableFooter
          shown={clientes.length}
          total={data?.totalElements ?? 0}
          page={page}
          totalPages={totalPages}
          countLabel={fmt(tcl.footerCount, { shown: clientes.length, total: data?.totalElements ?? 0 })}
          isFetching={isFetching}
          onPage={setPage}
        />
      )}

      <ConfirmDialog
        isOpen={!!pendenteInativar}
        onClose={() => setPendenteInativar(null)}
        onConfirm={() => void confirmarInativar()}
        title={tcl.deactivate}
        confirmLabel={tcl.deactivate}
        message={fmt(tcl.deactivateConfirm, { nome: pendenteInativar?.nome ?? '' })}
        isConfirming={inativar.isPending}
      />
    </div>
  );
};
