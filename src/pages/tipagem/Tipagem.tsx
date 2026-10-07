import React, { useState } from 'react';
import { Card, Badge, Dialog, Tabs } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { InfoHint } from '../../components/shared/InfoHint';
import { ActionMenu } from '../../components/shared/ActionMenu';
import { Icon } from '../../components/shared/Icon';
import { useAppStore } from '../../store/useAppStore';
import {
  useTiposServicoAdmin,
  useCreateTipoServico,
  usePatchTipoServico,
} from '../../api/catalogo';
import {
  useServicos,
  useCreateServico,
  usePatchServico,
  useDeleteServico,
  useSetTipoPlenoCodigo,
  type ServicoView,
} from '../../api/servicos';
import { useTranslation, fmt } from '../../i18n';
import './Tipagem.css';

type TabId = 'servicos' | 'tipos';

// Aba "Produtos" — CRUD do Produto (agrupa N Serviços).

// ID externo (tip_vis_codigo no integrador) do vínculo Produto×Serviço — só existe para
// serviços já vinculados a um produto persistido; salva ao perder o foco (padrão da aba Serviço).
const TipoCodigoField: React.FC<{
  servicoId: string;
  tipoId: string;
  tipoNome: string;
  valorInicial: number | null;
}> = ({ servicoId, tipoId, tipoNome, valorInicial }) => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tt = t.tipagem;
  const setCodigo = useSetTipoPlenoCodigo();
  const [valor, setValor] = useState(valorInicial != null ? String(valorInicial) : '');

  React.useEffect(() => {
    setValor(valorInicial != null ? String(valorInicial) : '');
  }, [valorInicial]);

  const salvar = async () => {
    const trimmed = valor.trim();
    const codigo = trimmed === '' ? null : Number(trimmed);
    if (codigo !== null && !Number.isFinite(codigo)) return;
    if (codigo === (valorInicial ?? null)) return;
    try {
      await setCodigo.mutateAsync({ servicoId, tipoServicoId: tipoId, codigo });
      setToast(tt.externalIdUpdated);
    } catch (e) {
      setToast(e instanceof Error ? e.message : tt.externalIdError);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <input
      className="form-input tipagem-codigo-input"
      type="number"
      aria-label={fmt(tt.externalIdAria, { nome: tipoNome })}
      placeholder={tt.externalIdPlaceholder}
      value={valor}
      disabled={setCodigo.isPending}
      onChange={(e) => setValor(e.target.value)}
      onBlur={salvar}
    />
  );
};

const ServicoDialog: React.FC<{
  aberto: boolean;
  onClose: () => void;
  servico: ServicoView | null;
}> = ({ aberto, onClose, servico }) => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tt = t.tipagem;
  const tipos = useTiposServicoAdmin().data?.content ?? [];
  const criar = useCreateServico();
  const patch = usePatchServico();

  const [nome, setNome] = useState(servico?.nome ?? '');
  const [tipoIds, setTipoIds] = useState<string[]>(servico?.tipos.map((tp) => tp.id) ?? []);

  // Reinicia o form sempre que o diálogo abre para outro produto.
  React.useEffect(() => {
    if (aberto) {
      setNome(servico?.nome ?? '');
      setTipoIds(servico?.tipos.map((tp) => tp.id) ?? []);
    }
  }, [aberto, servico]);

  const toggleTipo = (id: string) =>
    setTipoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Serviços ainda não adicionados ao grupo — o que sobra para o select do topo.
  const tiposDisponiveis = tipos.filter((tp) => !tipoIds.includes(tp.id));

  const salvar = async () => {
    const n = nome.trim();
    if (!n) {
      setToast(tt.provideServiceName);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      if (servico) {
        await patch.mutateAsync({ id: servico.id, nome: n, tipoServicoIds: tipoIds });
        setToast(tt.serviceUpdated);
      } else {
        await criar.mutateAsync({ nome: n, tipoServicoIds: tipoIds });
        setToast(tt.serviceCreated);
      }
      onClose();
    } catch (e) {
      setToast(e instanceof Error ? e.message : tt.serviceSaveError);
    }
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <Dialog
      isOpen={aberto}
      onClose={onClose}
      title={servico ? tt.editService : tt.newService}
      info={tt.servicesHint}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>{tt.cancel}</Button>
          <Button
            variant="primary"
            size="md"
            onClick={salvar}
            disabled={criar.isPending || patch.isPending}
          >
            {criar.isPending || patch.isPending ? tt.savingShort : tt.save}
          </Button>
        </>
      }
    >
      <Input
        label={tt.serviceNameLabel}
        placeholder={tt.serviceNamePlaceholder}
        value={nome}
        autoFocus
        onChange={(e) => setNome(e.target.value)}
      />
      <div className="tipagem-field">
        <span className="tipagem-eyebrow">{tt.groupedTypes}</span>

        {tipos.length === 0 ? (
          <p className="tipagem-empty">{tt.noTypesYet}</p>
        ) : (
          <>
            <select
              className="form-select"
              aria-label={tt.addGroupedType}
              value=""
              onChange={(e) => { if (e.target.value) toggleTipo(e.target.value); }}
              disabled={tiposDisponiveis.length === 0}
            >
              <option value="">{tt.addGroupedType}</option>
              {tiposDisponiveis.map((tp) => (
                <option key={tp.id} value={tp.id}>{tp.nome}</option>
              ))}
            </select>

            {tipoIds.length === 0 ? (
              <p className="tipagem-empty">{tt.noGroupedTypes}</p>
            ) : (
              <ul className="tipagem-grouped-list">
                {tipoIds.map((id) => {
                  const tp = tipos.find((x) => x.id === id);
                  if (!tp) return null;
                  const vinculado = servico?.tipos.find((st) => st.id === id);
                  return (
                    <li key={id} className="tipagem-grouped-row">
                      <span className="tipagem-grouped-nome">{tp.nome}</span>
                      {servico && vinculado ? (
                        <TipoCodigoField
                          servicoId={servico.id}
                          tipoId={id}
                          tipoNome={tp.nome}
                          valorInicial={vinculado.plenoTipVisCodigo}
                        />
                      ) : (
                        <input
                          className="form-input tipagem-codigo-input"
                          aria-label={fmt(tt.externalIdAria, { nome: tp.nome })}
                          placeholder={tt.externalIdPlaceholder}
                          title={tt.externalIdAfterSave}
                          disabled
                        />
                      )}
                      <button
                        type="button"
                        className="tipagem-grouped-remove"
                        aria-label={fmt(tt.removeGroupedType, { nome: tp.nome })}
                        onClick={() => toggleTipo(id)}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
};

const AbaServicos: React.FC<{ novoAberto: boolean; onNovoClose: () => void }> = ({
  novoAberto,
  onNovoClose,
}) => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tt = t.tipagem;
  const servicosQuery = useServicos();
  const patch = usePatchServico();
  const remover = useDeleteServico();

  const [editando, setEditando] = useState<ServicoView | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const servicos = servicosQuery.data ?? [];

  // O diálogo abre para "novo" (controlado pelo header da tela) ou para edição de um item.
  const dialogAberto = novoAberto || editando !== null;
  const abrirEdicao = (s: ServicoView) => setEditando(s);
  const fecharDialog = () => { setEditando(null); onNovoClose(); };

  const toggleAtivo = async (s: ServicoView) => {
    try {
      await patch.mutateAsync({ id: s.id, ativo: !s.ativo });
    } catch (e) {
      setToast(e instanceof Error ? e.message : tt.genericError);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const excluir = async (s: ServicoView) => {
    try {
      await remover.mutateAsync(s.id);
      setToast(tt.serviceDeleted);
    } catch (e) {
      setToast(e instanceof Error ? e.message : tt.deleteError);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="tipagem-panel">
      <Card>
        {servicosQuery.isLoading && <p className="tipagem-empty">{tt.loading}</p>}
        {servicosQuery.error && <p className="tipagem-empty">{tt.servicesLoadError}</p>}
        {!servicosQuery.isLoading && !servicosQuery.error && servicos.length === 0 && (
          <p className="tipagem-empty">{tt.noServices}</p>
        )}

        {servicos.map((s) => {
          const aberto = expandidoId === s.id;
          return (
          <div key={s.id} className="tipagem-item">
            <div className="tipagem-item-bar">
              <button
                type="button"
                className="tipagem-item-name"
                aria-expanded={aberto}
                onClick={() => setExpandidoId(aberto ? null : s.id)}
              >
                {s.nome}
              </button>
              <div className="tipagem-item-actions">
                <Badge tone={s.ativo ? 'ink' : 'gray'}>{s.ativo ? tt.statusActive : tt.statusInactive}</Badge>
                <ActionMenu
                  size="sm"
                  trigger={<Icon name="ellipsis-vertical" />}
                  label={fmt(tt.rowActions, { nome: s.nome })}
                  items={[
                    { key: 'edit', label: tt.edit, onClick: () => abrirEdicao(s) },
                    {
                      key: 'toggle',
                      label: s.ativo ? tt.deactivate : tt.activate,
                      onClick: () => toggleAtivo(s),
                      disabled: patch.isPending,
                    },
                    {
                      key: 'delete',
                      label: tt.delete,
                      danger: true,
                      onClick: () => excluir(s),
                      disabled: remover.isPending,
                    },
                  ]}
                />
              </div>
            </div>
            {aberto && (
              <div className="tipagem-item-tipos">
                {s.tipos.length === 0
                  ? <span className="tipagem-muted">{tt.noTypes}</span>
                  : s.tipos.map((tp) => <span key={tp.id} className="tipagem-tag">{tp.nome}</span>)}
              </div>
            )}
          </div>
          );
        })}
      </Card>

      <ServicoDialog aberto={dialogAberto} onClose={fecharDialog} servico={editando} />
    </div>
  );
};

// Aba "Serviço" — CRUD do catálogo global (migrado de Servicos.tsx).

const AbaTipos: React.FC<{ novoAberto: boolean; onNovoClose: () => void }> = ({
  novoAberto,
  onNovoClose,
}) => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tt = t.tipagem;
  const tiposQuery = useTiposServicoAdmin();
  const criar = useCreateTipoServico();
  const patch = usePatchTipoServico();

  const [novo, setNovo] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  const tipos = tiposQuery.data?.content ?? [];

  const add = async () => {
    const nome = novo.trim();
    if (!nome) return;
    try {
      await criar.mutateAsync(nome);
      setNovo('');
      onNovoClose();
      setToast(tt.typeCreated);
    } catch (e) { setToast(e instanceof Error ? e.message : tt.typeCreateError); }
    setTimeout(() => setToast(null), 3000);
  };

  const salvarNome = async (id: string) => {
    const nome = editNome.trim();
    if (!nome) { setEditId(null); return; }
    try {
      await patch.mutateAsync({ id, nome });
      setEditId(null);
      setToast(tt.typeUpdated);
    } catch (e) { setToast(e instanceof Error ? e.message : tt.genericError); }
    setTimeout(() => setToast(null), 3000);
  };

  const toggle = async (id: string, ativo: boolean) => {
    try { await patch.mutateAsync({ id, ativo: !ativo }); }
    catch (e) { setToast(e instanceof Error ? e.message : tt.genericError); setTimeout(() => setToast(null), 3000); }
  };

  return (
    <div className="tipagem-panel">
      <Card>
        {tiposQuery.isLoading && <p className="tipagem-empty">{tt.loading}</p>}
        {tiposQuery.error && <p className="tipagem-empty">{tt.typesLoadError}</p>}
        {!tiposQuery.isLoading && tipos.length === 0 && <p className="tipagem-empty">{tt.noTypesRegistered}</p>}

        {tipos.map((tp) => (
          <div key={tp.id} className="tipagem-item">
            <div className="tipagem-item-bar">
              <div className="tipagem-item-main">
                {editId === tp.id ? (
                  <input
                    className="form-input tipagem-edit"
                    aria-label={tt.renameAria}
                    value={editNome}
                    autoFocus
                    onChange={(e) => setEditNome(e.target.value)}
                    onBlur={() => salvarNome(tp.id)}
                    onKeyDown={(e) => e.key === 'Enter' && salvarNome(tp.id)}
                  />
                ) : (
                  <span className="tipagem-item-name tipagem-item-name--static">{tp.nome}</span>
                )}
              </div>
              <div className="tipagem-item-actions">
                <Badge tone={tp.ativo ? 'ink' : 'gray'}>{tp.ativo ? tt.statusActive : tt.statusInactive}</Badge>
                <ActionMenu
                  size="sm"
                  trigger={<Icon name="ellipsis-vertical" />}
                  label={fmt(tt.rowActions, { nome: tp.nome })}
                  items={[
                    {
                      key: 'rename',
                      label: tt.rename,
                      onClick: () => { setEditId(tp.id); setEditNome(tp.nome); },
                    },
                    {
                      key: 'toggle',
                      label: tp.ativo ? tt.deactivate : tt.activate,
                      onClick: () => toggle(tp.id, tp.ativo),
                      disabled: patch.isPending,
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Dialog
        isOpen={novoAberto}
        onClose={onNovoClose}
        title={tt.newTypeTitle}
        info={tt.typesHint}
        actions={
          <>
            <Button variant="secondary" size="md" onClick={onNovoClose}>{tt.cancel}</Button>
            <Button variant="primary" size="md" onClick={add} disabled={criar.isPending}>
              {criar.isPending ? tt.creating : tt.create}
            </Button>
          </>
        }
      >
        <Input
          label={tt.typeNameLabel}
          aria-label={tt.typeNameAria}
          placeholder={tt.typeNamePlaceholder}
          value={novo}
          autoFocus
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
      </Dialog>
    </div>
  );
};


export const Tipagem: React.FC = () => {
  const { t } = useTranslation();
  const tt = t.tipagem;
  const [tab, setTab] = useState<TabId>('servicos');
  const [novoAberto, setNovoAberto] = useState(false);

  return (
    <div className="tipagem-container">
      <div className="tipagem-header">
        <div>
          <InfoHint title={t.nav.config.tipagem}>
            <p>{tt.hintP1}</p>
            <p>
              {tt.hintP2Prefix}<strong>{tt.hintP2Bold1}</strong>{tt.hintP2Mid}<strong>{tt.hintP2Bold2}</strong>{tt.hintP2Suffix}
            </p>
          </InfoHint>
        </div>
        <Button variant="accent" size="md" onClick={() => setNovoAberto(true)}>
          <Icon name="plus" size={14} /> {tab === 'servicos' ? tt.newServiceBtn : tt.newTypeBtn}
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'servicos', label: tt.tabServices },
          { id: 'tipos', label: tt.tabTypes },
        ]}
        activeTab={tab}
        onTabChange={(id) => { setTab(id as TabId); setNovoAberto(false); }}
      />

      {tab === 'servicos'
        ? <AbaServicos novoAberto={novoAberto} onNovoClose={() => setNovoAberto(false)} />
        : <AbaTipos novoAberto={novoAberto} onNovoClose={() => setNovoAberto(false)} />}
    </div>
  );
};
