import React, { useEffect, useState } from 'react';
import { Card, Badge, Dialog } from '../../components/shared/DataDisplay';
import { Input, Select } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { InfoHint } from '../../components/shared/InfoHint';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { ActionMenu } from '../../components/shared/ActionMenu';
import { FilterPopover } from '../../components/shared/FilterPopover';
import { ListTableFooter } from '../../components/shared/ListTableFooter';
import { Icon } from '../../components/shared/Icon';
import {
  useUsuarios,
  useImobiliarias,
  useInviteUsuario,
  useResendInvite,
  usePatchUsuario,
  type Usuario,
  type UsuarioStatus,
  type UsuarioPerfil,
} from '../../api/admin';
import { useAppStore } from '../../store/useAppStore';
import { isEmail } from '../../utils/pessoaDocumento';
import { useTranslation, fmt } from '../../i18n';
import './Usuarios.css';
import '../../components/shared/ListTable.css';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<UsuarioStatus, 'ink' | 'gray' | 'outline'> = {
  ativo: 'ink',
  inativo: 'gray',
  convidado: 'outline',
};

/** Perfis convidáveis a partir desta tela (não inclui `cliente` — nasce do fluxo da solicitação). */
const PERFIS_CONVIDAVEIS: UsuarioPerfil[] = ['admin', 'suporte', 'imob_gerencia', 'imob_operacao', 'vistoriador'];

/** Perfis que a gerência enxerga (o backend já restringe a mesma coisa; isto é só o rótulo do filtro). */
const PERFIS_EQUIPE_AGENCIA: UsuarioPerfil[] = ['imob_gerencia', 'imob_operacao'];

const PERFIL_EXIGE_IMOBILIARIA = (perfil: UsuarioPerfil) =>
  perfil === 'imob_gerencia' || perfil === 'imob_operacao';

const initials = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

const emptyInviteForm = (perfil: UsuarioPerfil) => ({ nome: '', email: '', perfil, imobiliariaId: '' });

/**
 * Usuários — tela unificada (movida de Configurações/Clientes) com visibilidade por papel:
 *  - ADMIN/SUPORTE: veem todos os perfis e podem convidar/editar/(des)ativar qualquer um.
 *  - IMOB_GERENCIA: vê só a equipe (gerência/operação) da própria imobiliária, somente leitura
 *    (convite, troca de perfil, reenvio e (des)ativação são ADMIN/SUPORTE no backend).
 *  - Demais perfis (operação, vistoriador, cliente) não acessam esta tela.
 */
export const Usuarios: React.FC = () => {
  const { setToast, auth } = useAppStore();
  const { t } = useTranslation();
  const tu = t.usuarios;
  const STATUS_LABEL = tu.statusLabels as Record<UsuarioStatus, string>;
  const PERFIL_LABEL = t.layout.sidebar.roles as Record<UsuarioPerfil, string>;
  const currentUserId = auth.userId;
  const isAdmin = auth.perfil === 'admin';
  const isSuporte = auth.perfil === 'suporte';
  const isStaff = isAdmin || isSuporte;
  const perfisConvidaveis = isAdmin
    ? PERFIS_CONVIDAVEIS
    : PERFIS_CONVIDAVEIS.filter((p) => p !== 'admin');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [perfilFilter, setPerfilFilter] = useState<'Todos' | UsuarioPerfil>('Todos');
  const [statusFilter, setStatusFilter] = useState<UsuarioStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm('imob_operacao'));
  const [vistImobIds, setVistImobIds] = useState<string[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [pendente, setPendente] = useState<{ tipo: 'excluir' | 'desativar'; user: Usuario } | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, error } = useUsuarios({
    page,
    size: PAGE_SIZE,
    perfil: perfilFilter === 'Todos' ? undefined : perfilFilter,
    status: statusFilter || undefined,
    q: search.trim() || undefined,
  });
  const { data: imobiliariasData } = useImobiliarias(undefined, { enabled: isStaff });
  const invite = useInviteUsuario();
  const resend = useResendInvite();
  const patch = usePatchUsuario();

  const agencias = imobiliariasData?.content ?? [];
  const usuarios = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const filtrosAtivos =
    (search.trim() ? 1 : 0)
    + (perfilFilter !== 'Todos' ? 1 : 0)
    + (statusFilter ? 1 : 0);

  const toast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  };

  const perfisFiltraveis = isStaff ? PERFIS_CONVIDAVEIS.concat('cliente') : PERFIS_EQUIPE_AGENCIA;

  useEffect(() => { setPage(0); }, [search, statusFilter, perfilFilter]);
  useEffect(() => {
    if (page > 0 && totalPages > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);

  const toggleStatus = async (u: Usuario) => {
    const novo: UsuarioStatus = u.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await patch.mutateAsync({ id: u.id, status: novo });
      toast(novo === 'ativo' ? tu.userReactivated : tu.userDeactivated);
    } catch (e) {
      toast(e instanceof Error ? e.message : tu.updateError);
    }
  };

  const reenviar = async (u: Usuario) => {
    setResendingId(u.id);
    try {
      await resend.mutateAsync(u.id);
      toast(fmt(tu.inviteResent, { email: u.email }));
    } catch (e) {
      toast(e instanceof Error ? e.message : tu.inviteResendError);
    } finally {
      setResendingId(null);
    }
  };

  const fecharForm = () => {
    setFormOpen(false);
    setEditing(null);
    setVistImobIds([]);
  };

  const abrirConvite = () => {
    setEditing(null);
    setVistImobIds([]);
    setInviteForm(emptyInviteForm('imob_operacao'));
    setFormOpen(true);
  };

  const abrirEdicao = (u: Usuario) => {
    setEditing(u);
    setVistImobIds([]);
    setInviteForm({
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      imobiliariaId: u.imobiliariaId ?? '',
    });
    setFormOpen(true);
  };

  const salvarEdicao = async () => {
    if (!editing) return;
    const nome = inviteForm.nome.trim();
    if (!nome) {
      toast(tu.fillName);
      return;
    }
    if (PERFIL_EXIGE_IMOBILIARIA(inviteForm.perfil) && !inviteForm.imobiliariaId) {
      toast(tu.selectAgency);
      return;
    }
    try {
      await patch.mutateAsync({
        id: editing.id,
        nome,
        perfil: inviteForm.perfil,
        ...(PERFIL_EXIGE_IMOBILIARIA(inviteForm.perfil) ? { imobiliariaId: inviteForm.imobiliariaId } : {}),
      });
      fecharForm();
      toast(tu.userUpdated);
    } catch (e) {
      toast(e instanceof Error ? e.message : tu.updateError);
    }
  };

  const excluirConvite = async (u: Usuario) => {
    try {
      await patch.mutateAsync({ id: u.id, status: 'inativo' });
      toast(tu.inviteDeleted);
    } catch (e) {
      toast(e instanceof Error ? e.message : tu.deleteInviteError);
    }
  };

  const confirmarPendente = async () => {
    if (!pendente) return;
    if (pendente.tipo === 'excluir') await excluirConvite(pendente.user);
    else await toggleStatus(pendente.user);
    setPendente(null);
  };

  const enviarConvite = async () => {
    const nome = inviteForm.nome.trim();
    const email = inviteForm.email.trim();
    if (!nome || !email) {
      toast(tu.fillNameEmail);
      return;
    }
    if (!isEmail(email)) {
      toast(t.validation.emailInvalid);
      return;
    }
    if (PERFIL_EXIGE_IMOBILIARIA(inviteForm.perfil) && !inviteForm.imobiliariaId) {
      toast(tu.selectAgency);
      return;
    }
    const imobiliariaIds = PERFIL_EXIGE_IMOBILIARIA(inviteForm.perfil)
      ? [inviteForm.imobiliariaId]
      : inviteForm.perfil === 'vistoriador' && vistImobIds.length > 0
        ? vistImobIds
        : undefined;
    try {
      await invite.mutateAsync({ nome, email, perfil: inviteForm.perfil, imobiliariaIds });
      fecharForm();
      toast(fmt(tu.inviteSent, { email }));
    } catch (e) {
      toast(e instanceof Error ? e.message : tu.inviteError);
    }
  };

  return (
    <div className="sysu-container">
      <div className="sysu-header">
        <div className="sysu-title">
          <InfoHint title={t.nav.items.usuarios}>
            <p>{tu.hintP1}</p>
            <p>{tu.hintP2}</p>
          </InfoHint>
        </div>
        <div className="sysu-header-actions">
          <FilterPopover
            activeCount={filtrosAtivos}
            onClear={() => {
              setSearchInput('');
              setSearch('');
              setPerfilFilter('Todos');
              setStatusFilter('');
            }}
          >
            <Input
              label={tu.filterBySearch}
              placeholder={tu.searchPlaceholder}
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Select
              label={tu.filterByRole}
              options={[tu.filterAll, ...perfisFiltraveis.map((p) => PERFIL_LABEL[p])]}
              value={perfilFilter === 'Todos' ? tu.filterAll : PERFIL_LABEL[perfilFilter]}
              onChange={(e) => {
                const label = e.target.value;
                const perfil = perfisFiltraveis.find((p) => PERFIL_LABEL[p] === label);
                setPerfilFilter(perfil ?? 'Todos');
              }}
            />
            <Select
              label={tu.filterByStatus}
              options={[tu.filterAll, tu.statusFilterActive, tu.statusFilterInactive, tu.statusFilterInvited]}
              value={statusFilter ? STATUS_LABEL[statusFilter] : tu.filterAll}
              onChange={(e) => {
                const label = e.target.value;
                const status = (Object.keys(STATUS_LABEL) as UsuarioStatus[])
                  .find((s) => STATUS_LABEL[s] === label);
                setStatusFilter(status ?? '');
              }}
            />
          </FilterPopover>
          {isStaff && (
            <Button variant="accent" size="md" onClick={abrirConvite}>
              <Icon name="plus" size={14} /> {tu.inviteUser}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="list-table" style={{ ['--list-table-cols' as string]: 'minmax(0, 2.2fr) 1.2fr 0.9fr 88px' }}>
          <div className="list-table-header">
            <span>{tu.colName}</span>
            <span>{tu.colRole}</span>
            <span>{tu.colStatus}</span>
            <span />
          </div>

          {isLoading && (
            <div className="list-table-empty">
              <p>{t.common.loading}</p>
            </div>
          )}
          {error && (
            <div className="list-table-empty list-table-empty--erro">
              <p>{tu.loadError}</p>
            </div>
          )}

          {!isLoading && !error && usuarios.map((u) => {
            const ehProprio = u.id === currentUserId;
            const podeEditar = isStaff && !ehProprio && !(isSuporte && u.perfil === 'admin');
            const convitePendente = u.status === 'convidado' || (u.status === 'inativo' && u.senhaDefinida === false);
            const menuItems = [
              { key: 'edit', label: t.common.edit, onClick: () => abrirEdicao(u) },
              ...(convitePendente
                ? [{ key: 'resend', label: tu.resendInvite, disabled: resendingId === u.id, onClick: () => reenviar(u) }]
                : []),
              ...(u.status === 'convidado'
                ? [{ key: 'drop', label: tu.deleteInvite, danger: true, onClick: () => setPendente({ tipo: 'excluir', user: u }) }]
                : u.status === 'ativo'
                  ? [{ key: 'off', label: tu.deactivateUser, danger: true, onClick: () => setPendente({ tipo: 'desativar', user: u }) }]
                  : u.senhaDefinida !== false
                    ? [{ key: 'on', label: tu.reactivateUser, onClick: () => toggleStatus(u) }]
                    : []),
            ];
            return (
              <div key={u.id} className="list-table-row sysu-row">
                <span className="list-table-identity">
                  <span className="list-table-avatar" aria-hidden="true">{initials(u.nome)}</span>
                  <span className="list-table-identity-text">
                    <span className="list-table-name">{u.nome}</span>
                    <span className="list-table-sub">{u.email}</span>
                  </span>
                </span>
                <span className="list-table-col" data-label={tu.colRole}>
                  <Badge tone="outline">{PERFIL_LABEL[u.perfil] ?? u.perfil}</Badge>
                </span>
                <span className="list-table-col" data-label={tu.colStatus}>
                  <Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge>
                </span>
                <span className="list-table-end sysu-acoes">
                  {ehProprio && <span className="sysu-proprio">{tu.you}</span>}
                  {podeEditar && (
                    <ActionMenu
                      size="sm"
                      trigger={<Icon name="ellipsis-vertical" />}
                      label={fmt(tu.rowActions, { nome: u.nome })}
                      items={menuItems}
                    />
                  )}
                </span>
              </div>
            );
          })}

          {!isLoading && !error && usuarios.length === 0 && (
            <div className="list-table-empty">
              {filtrosAtivos > 0 ? tu.emptyFiltered : tu.emptyNone}
            </div>
          )}
        </div>
      </Card>

      {!isLoading && !error && (
        <ListTableFooter
          shown={usuarios.length}
          total={data?.totalElements ?? 0}
          page={page}
          totalPages={totalPages}
          countLabel={fmt(tu.footerCount, { shown: usuarios.length, total: data?.totalElements ?? 0 })}
          onPage={setPage}
        />
      )}

      {isStaff && (
        <Dialog
          isOpen={formOpen}
          onClose={fecharForm}
          title={editing ? tu.editUser : tu.inviteUser}
          actions={
            <>
              <Button variant="secondary" size="md" type="button" onClick={fecharForm}>
                {t.common.cancel}
              </Button>
              {editing ? (
                <Button variant="accent" size="md" type="submit" form="usu-form" disabled={patch.isPending}>
                  {t.common.save}
                </Button>
              ) : (
                <Button variant="accent" size="md" type="submit" form="usu-form" disabled={invite.isPending}>
                  {invite.isPending ? tu.sending : tu.sendInvite}
                </Button>
              )}
            </>
          }
        >
          <form
            id="usu-form"
            className="sysu-invite"
            onSubmit={(e) => {
              e.preventDefault();
              void (editing ? salvarEdicao() : enviarConvite());
            }}
          >
            <p className="sysu-invite-hint">{editing ? tu.editHint : tu.inviteHint}</p>
            <Input
              label={tu.nameLabel}
              placeholder={tu.namePlaceholder}
              value={inviteForm.nome}
              onChange={(e) => setInviteForm((f) => ({ ...f, nome: e.target.value }))}
            />
            <Input
              label={tu.emailLabel}
              type="email"
              placeholder={tu.emailPlaceholder}
              value={inviteForm.email}
              readOnly={!!editing}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
            />
            <div className="form-group">
              <label className="form-label" htmlFor="usu-invite-perfil">{tu.roleLabel}</label>
              <select
                id="usu-invite-perfil"
                className="form-select"
                value={inviteForm.perfil}
                onChange={(e) => setInviteForm((f) => ({ ...f, perfil: e.target.value as UsuarioPerfil }))}
              >
                {(editing
                  ? Array.from(new Set<UsuarioPerfil>([editing.perfil, ...perfisConvidaveis]))
                  : perfisConvidaveis
                ).map((perfil) => (
                  <option key={perfil} value={perfil}>{PERFIL_LABEL[perfil]}</option>
                ))}
              </select>
            </div>
            {PERFIL_EXIGE_IMOBILIARIA(inviteForm.perfil) && (
              <div className="form-group">
                <label className="form-label" htmlFor="usu-invite-imobiliaria">{tu.agencyLabel}</label>
                <select
                  id="usu-invite-imobiliaria"
                  className="form-select"
                  value={inviteForm.imobiliariaId}
                  onChange={(e) => setInviteForm((f) => ({ ...f, imobiliariaId: e.target.value }))}
                >
                  <option value="">{t.common.select}</option>
                  {agencias.map((a) => (
                    <option key={a.id} value={a.id}>{a.razaoSocial}</option>
                  ))}
                </select>
              </div>
            )}
            {!editing && inviteForm.perfil === 'vistoriador' && (
              <fieldset className="form-group invite-vist-imobs">
                <legend className="form-label">{tu.agenciesOptional}</legend>
                {agencias.map((a) => (
                  <label key={a.id} className="invite-vist-imob">
                    <input
                      type="checkbox"
                      checked={vistImobIds.includes(a.id)}
                      onChange={(e) =>
                        setVistImobIds((ids) =>
                          e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id),
                        )
                      }
                    />
                    <span>{a.nomeFantasia || a.razaoSocial}</span>
                  </label>
                ))}
                {agencias.length === 0 && <p className="sysu-empty">{tu.noAgencies}</p>}
              </fieldset>
            )}
          </form>
        </Dialog>
      )}

      <ConfirmDialog
        isOpen={!!pendente}
        onClose={() => setPendente(null)}
        onConfirm={() => void confirmarPendente()}
        title={pendente?.tipo === 'excluir' ? tu.deleteInvite : tu.deactivateUser}
        confirmLabel={pendente?.tipo === 'excluir' ? tu.deleteInvite : tu.deactivateUser}
        message={
          pendente?.tipo === 'excluir'
            ? fmt(tu.deleteInviteConfirm, { nome: pendente.user.nome })
            : fmt(tu.deactivateConfirm, { nome: pendente?.user.nome ?? '' })
        }
        isConfirming={patch.isPending}
      />
    </div>
  );
};
