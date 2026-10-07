import React, { useId, useMemo, useState } from 'react';
import { Card, Dialog } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { Input, Select } from '../../components/shared/Input';
import { InfoHint } from '../../components/shared/InfoHint';
import { ActionMenu } from '../../components/shared/ActionMenu';
import { Icon } from '../../components/shared/Icon';
import { FilterPopover } from '../../components/shared/FilterPopover';
import { ListTableFooter } from '../../components/shared/ListTableFooter';
import { useCreateCidade, useDeleteCidade } from '../../api/catalogo';
import { useCidades, type Cidade } from '../../api/imoveis';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation, fmt } from '../../i18n';
import './Catalog.css';
import '../../components/shared/ListTable.css';

const PAGE_SIZE = 20;
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const inicial = (nome: string) => (nome.trim()[0] || '?').toUpperCase();

export const Catalog: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tc = t.cities;
  const mensagemErro = (e: unknown) =>
    e instanceof Error && e.message ? e.message : tc.createError;
  const formId = useId();

  const cidadesQuery = useCidades();
  const criarCidade = useCreateCidade();
  const excluirCidade = useDeleteCidade();

  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(0);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoUf, setNovoUf] = useState('');
  const [aExcluir, setAExcluir] = useState<Cidade | null>(null);

  const { data, isLoading, error, isFetching = false } = cidadesQuery;

  const cidades = useMemo(() => data ?? [], [data]);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return cidades;
    return cidades.filter((c) => c.nome.toLowerCase().includes(q) || c.uf.toLowerCase().includes(q));
  }, [cidades, busca]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pagina = filtradas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  React.useEffect(() => { setPage(0); }, [busca]);
  React.useEffect(() => {
    if (page > 0 && filtradas.length > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages, filtradas.length]);

  const fecharDialog = () => {
    setDialogAberto(false);
    setNovoNome('');
    setNovoUf('');
  };

  const adicionar = async () => {
    const nome = novoNome.trim();
    if (!nome || !novoUf) {
      setToast(tc.provideNameUf);
      return;
    }
    try {
      await criarCidade.mutateAsync({ nome, uf: novoUf });
      fecharDialog();
      setToast(tc.cityCreated);
    } catch (e: unknown) {
      setToast(mensagemErro(e));
    }
  };

  const confirmarExclusao = async () => {
    if (!aExcluir) return;
    try {
      await excluirCidade.mutateAsync(aExcluir.id);
      setToast(fmt(tc.cityDeleted, { nome: aExcluir.nome }));
      setAExcluir(null);
    } catch (e: unknown) {
      setToast(e instanceof Error && e.message ? e.message : tc.deleteError);
      setAExcluir(null);
    }
  };

  const vazia = !isLoading && !error && cidades.length === 0;
  const semFiltro = !isLoading && !error && cidades.length > 0 && filtradas.length === 0;

  return (
    <div className="catalog-container">
      <div className="catalog-header">
        <div className="catalog-title">
          <InfoHint title={t.nav.items.cities}>
            <p>{tc.hintP1}</p>
            <p>
              {tc.hintP2Prefix}<strong>{tc.hintP2Bold}</strong>{tc.hintP2Suffix}
            </p>
          </InfoHint>
        </div>
        <div className="catalog-header-actions">
          <FilterPopover
            activeCount={busca.trim() ? 1 : 0}
            onClear={() => setBusca('')}
          >
            <Input
              type="search"
              label={tc.searchAria}
              placeholder={tc.searchPlaceholder}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </FilterPopover>
          <Button variant="accent" size="md" onClick={() => setDialogAberto(true)}>
            <Icon name="plus" size={14} /> {tc.newCity}
          </Button>
        </div>
      </div>

      <Card>
        <div className="list-table" style={{ ['--list-table-cols' as string]: 'minmax(0, 2fr) 0.6fr 32px' }}>
          <div className="list-table-header">
            <div>{tc.colCity}</div>
            <div>{tc.colUf}</div>
            <div />
          </div>

          {isLoading && <div className="list-table-empty">{tc.loading}</div>}
          {error && <div className="list-table-empty list-table-empty--erro">{tc.loadError}</div>}
          {vazia && <div className="list-table-empty">{tc.emptyNone}</div>}
          {semFiltro && (
            <div className="list-table-empty">{fmt(tc.noMatch, { termo: busca.trim() })}</div>
          )}

          {!isLoading && !error && pagina.map((c) => (
            <div key={c.id} className="list-table-row catalog-row">
              <div className="list-table-identity">
                <span className="list-table-avatar" aria-hidden="true">{inicial(c.nome)}</span>
                <span className="list-table-name">{c.nome}</span>
              </div>
              <div className="list-table-col list-table-text" data-label={tc.colUf}>{c.uf}</div>
              <div className="list-table-end">
                <ActionMenu
                  size="sm"
                  trigger={<Icon name="ellipsis-vertical" />}
                  label={fmt(tc.rowActions, { nome: c.nome })}
                  items={[
                    { key: 'excluir', label: tc.deleteCity, danger: true, onClick: () => setAExcluir(c) },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {!isLoading && !error && (
        <ListTableFooter
          shown={pagina.length}
          total={filtradas.length}
          page={page}
          totalPages={filtradas.length === 0 ? 0 : totalPages}
          countLabel={fmt(tc.footerCount, { shown: pagina.length, total: filtradas.length })}
          isFetching={isFetching}
          onPage={setPage}
        />
      )}

      <Dialog
        isOpen={dialogAberto}
        onClose={fecharDialog}
        title={tc.dialogNewTitle}
        actions={
          <>
            <Button variant="ghost" size="md" onClick={fecharDialog}>
              {t.common.cancel}
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form={formId}
              disabled={criarCidade.isPending}
            >
              {criarCidade.isPending ? tc.adding : tc.add}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            adicionar();
          }}
        >
          <Input
            label={tc.cityNameLabel}
            placeholder={tc.cityNamePlaceholder}
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <Select
            label={tc.ufLabel}
            options={UFS}
            value={novoUf}
            onChange={(e) => setNovoUf(e.target.value)}
          />
        </form>
      </Dialog>

      <Dialog
        isOpen={aExcluir !== null}
        onClose={() => setAExcluir(null)}
        title={tc.dialogDeleteTitle}
        actions={
          <>
            <Button variant="ghost" size="md" onClick={() => setAExcluir(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="accent"
              size="md"
              onClick={confirmarExclusao}
              disabled={excluirCidade.isPending}
            >
              {excluirCidade.isPending ? tc.deleting : tc.delete}
            </Button>
          </>
        }
      >
        <p>
          {tc.deleteConfirmPrefix}<strong>{aExcluir?.nome}</strong> ({aExcluir?.uf}){tc.deleteConfirmSuffix}
        </p>
      </Dialog>
    </div>
  );
};
