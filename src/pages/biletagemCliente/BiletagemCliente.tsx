import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { InfoHint } from '../../components/shared/InfoHint';
import { Icon } from '../../components/shared/Icon';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import {
  useBiletagemCliente,
  usePutBiletagemCliente,
  type BiletagemClienteModo,
} from '../../api/biletagemCliente';
import { FAIXAS_REFERENCIA } from '../../api/contratos';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation, fmt } from '../../i18n';
import '../../components/shared/ImobiliariaEditForm.css';
import './BiletagemCliente.css';

interface PercentualForm { percentual: string; minimo: string; }
interface FaixaCell { semMob: string; comMob: string; }

const cellKey = (servicoId: string, faixaId: string) => `${servicoId}:${faixaId}`;

const num = (s: string): number | null => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};

/**
 * Biletagem Cliente — configuração global (não por imobiliária) de como cada
 * `b2c_service` (catálogo dinâmico, ver `api/b2cServicos.ts`) é cobrado: percentual
 * do valor da vistoria OU faixa de metragem (mesmas 5 faixas fixas do B2B —
 * `FAIXAS_REFERENCIA`). Uma aba por serviço; um cadeado global destrava a edição
 * célula-a-célula (um campo aberto por vez). Trocar o tipo de biletagem (faixa ↔
 * percentual) enquanto destravado descarta os valores digitados nesta sessão —
 * só um tipo é editável por vez, já que o `modo` salvo é único para todos os serviços.
 */
export const BiletagemCliente: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tbc = t.biletagemCliente;
  const query = useBiletagemCliente();
  const put = usePutBiletagemCliente();
  const isAdmin = useAppStore((s) => s.auth.perfil === 'admin');

  const faixaRef = [...FAIXAS_REFERENCIA].sort((a, b) => a.ordem - b.ordem);
  const servicos = query.data?.servicos ?? [];

  const [modo, setModo] = useState<BiletagemClienteModo>('faixa');
  const [selectedServicoId, setSelectedServicoId] = useState<string | null>(null);
  const [percentualPor, setPercentualPor] = useState<Record<string, PercentualForm>>({});
  const [faixaPor, setFaixaPor] = useState<Record<string, FaixaCell>>({});
  const [hidratado, setHidratado] = useState(false);
  const [valuesLocked, setValuesLocked] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pendingModo, setPendingModo] = useState<BiletagemClienteModo | null>(null);
  const [pendingSave, setPendingSave] = useState(false);

  const editSnapshotRef = useRef<{
    percentualPor: Record<string, PercentualForm>;
    faixaPor: Record<string, FaixaCell>;
  } | null>(null);

  // Hidrata o form uma vez, a partir do GET. Erro/404 não trava o draft — começa vazio.
  useEffect(() => {
    if (hidratado) return;
    if (query.isLoading) return;
    const d = query.data;
    if (d) {
      setModo(d.modo);
      setSelectedServicoId((cur) => cur ?? d.servicos[0]?.id ?? null);
      setPercentualPor(
        Object.fromEntries(
          d.percentuais.map((p) => [
            p.b2cServiceId,
            {
              percentual: p.percentual != null ? String(p.percentual) : '',
              minimo: p.minimo != null ? String(p.minimo) : '',
            },
          ]),
        ),
      );
      setFaixaPor(
        Object.fromEntries(
          d.faixas.map((f) => [
            cellKey(f.b2cServiceId, String(f.faixaReferenciaId)),
            {
              semMob: f.valorSemMob != null ? String(f.valorSemMob) : '',
              comMob: f.valorComMob != null ? String(f.valorComMob) : '',
            },
          ]),
        ),
      );
    }
    setHidratado(true);
  }, [hidratado, query.isLoading, query.data]);

  const setPct = (id: string, k: keyof PercentualForm, v: string) =>
    setPercentualPor((p) => ({ ...p, [id]: { ...(p[id] ?? { percentual: '', minimo: '' }), [k]: v } }));

  const setCell = (servicoId: string, faixaId: string, k: keyof FaixaCell, v: string) =>
    setFaixaPor((p) => {
      const kk = cellKey(servicoId, faixaId);
      return { ...p, [kk]: { ...(p[kk] ?? { semMob: '', comMob: '' }), [k]: v } };
    });

  const toast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const editKey = (key: string) => {
    if (!isAdmin || valuesLocked) return;
    setEditingKey(key);
  };
  const stopEditing = () => setEditingKey(null);

  const startEditing = () => {
    editSnapshotRef.current = { percentualPor, faixaPor };
    setValuesLocked(false);
  };

  const cancelEdit = () => {
    if (editSnapshotRef.current) {
      setPercentualPor(editSnapshotRef.current.percentualPor);
      setFaixaPor(editSnapshotRef.current.faixaPor);
    }
    setEditingKey(null);
    setValuesLocked(true);
  };

  const trySelectModo = (next: BiletagemClienteModo) => {
    if (!isAdmin || next === modo) return;
    if (!valuesLocked) {
      setPendingModo(next);
      return;
    }
    setModo(next);
  };

  const confirmSwitchModo = () => {
    if (editSnapshotRef.current) {
      setPercentualPor(editSnapshotRef.current.percentualPor);
      setFaixaPor(editSnapshotRef.current.faixaPor);
    }
    setEditingKey(null);
    setValuesLocked(true);
    if (pendingModo) setModo(pendingModo);
    setPendingModo(null);
  };

  const salvar = async () => {
    const percentuais = servicos.map((sv) => ({
      b2cServiceId: sv.id,
      percentual: num(percentualPor[sv.id]?.percentual ?? '') ?? 0,
      minimo: num(percentualPor[sv.id]?.minimo ?? ''),
    }));
    const faixas = servicos.flatMap((sv) =>
      faixaRef.map((fx) => {
        const cell = faixaPor[cellKey(sv.id, fx.id)];
        return {
          b2cServiceId: sv.id,
          faixaReferenciaId: Number(fx.id),
          valorSemMob: num(cell?.semMob ?? '') ?? 0,
          valorComMob: num(cell?.comMob ?? '') ?? 0,
        };
      }),
    );

    try {
      await put.mutateAsync({
        modo,
        percentuais: modo === 'percentual' ? percentuais : [],
        faixas: modo === 'faixa' ? faixas : [],
      });
      toast(tbc.saved);
      setValuesLocked(true);
      setEditingKey(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : tbc.saveError);
    }
  };

  const isFaixa = modo === 'faixa';
  const servicoAtual = servicos.find((s) => s.id === selectedServicoId) ?? null;
  const percentualAtual = selectedServicoId ? percentualPor[selectedServicoId] : undefined;

  return (
    <div className="bc-container">
      <InfoHint title={t.nav.config.biletagemCliente}>
        <p>{tbc.hintP1}</p>
        <p>{tbc.hintP2}</p>
        {!isAdmin && tbc.adminOnly}
      </InfoHint>

      <Card className="bc-card">
        <section className="bc-panel" aria-label={tbc.aria}>
          {query.isError && <p className="bc-aviso">{tbc.loadError}</p>}

          <div className="bc-tipo-block">
            <div className="type-label">{tbc.typeEyebrow}</div>
            <div className="imef-radio-cards">
              {([
                { id: 'faixa' as const, icon: 'properties' as const, titulo: tbc.rangeMode, desc: tbc.rangeModeDesc },
                { id: 'percentual' as const, icon: 'extrato' as const, titulo: tbc.percentMode, desc: tbc.percentModeDesc },
              ]).map((opt) => (
                <label
                  key={opt.id}
                  className={`imef-radio-card ${modo === opt.id ? 'imef-radio-card--on' : ''}`}
                >
                  <input
                    type="radio"
                    className="imef-radio-card-input"
                    name="biletagem-cliente-modo"
                    checked={modo === opt.id}
                    disabled={!isAdmin}
                    onChange={() => trySelectModo(opt.id)}
                  />
                  <span className="imef-radio-card-check" aria-hidden="true">
                    <Icon name="check" size={12} />
                  </span>
                  <span className="imef-radio-card-icon" aria-hidden="true">
                    <Icon name={opt.icon} size={20} />
                  </span>
                  <span className="imef-radio-card-t">{opt.titulo}</span>
                  <span className="imef-radio-card-d">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {servicos.length > 0 && (
            <>
              <div className="bc-tabsrow">
                <div className="bc-tabs" role="tablist">
                  {servicos.map((sv) => (
                    <button
                      key={sv.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedServicoId === sv.id}
                      className={`bc-tab ${selectedServicoId === sv.id ? 'bc-tab--active' : ''}`}
                      onClick={() => setSelectedServicoId(sv.id)}
                    >
                      {sv.nome}
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    className={`bc-lock ${!valuesLocked ? 'bc-lock--open' : ''}`}
                    onClick={valuesLocked ? startEditing : cancelEdit}
                  >
                    <Icon name={valuesLocked ? 'lock' : 'close'} size={13} />
                    <span>{valuesLocked ? tbc.editValues : tbc.cancelEditing}</span>
                  </button>
                )}
              </div>

              {isAdmin && (
                <p className="bc-lockhint">{valuesLocked ? tbc.lockedHint : tbc.unlockedHint}</p>
              )}

              {isFaixa ? (
                <div className="bc-faixa-scroll">
                  <div
                    className="bc-faixa-grid"
                    style={{ gridTemplateColumns: `150px repeat(${faixaRef.length}, 1fr)` }}
                  >
                    <div />
                    {faixaRef.map((fx) => (
                      <div key={fx.id} className="bc-faixa-head">{fx.rotulo}</div>
                    ))}

                    <div className="bc-faixa-rowlabel">{tbc.colNoFurniture}</div>
                    {faixaRef.map((fx) => {
                      const key = selectedServicoId ? cellKey(selectedServicoId, fx.id) : '';
                      const cell = faixaPor[key] ?? { semMob: '', comMob: '' };
                      const editing = editingKey === `sem:${key}`;
                      return (
                        <div key={fx.id} className="bc-faixa-cell">
                          {editing ? (
                            <input
                              type="text"
                              placeholder="0,00"
                              autoFocus
                              value={cell.semMob}
                              onChange={(e) => selectedServicoId && setCell(selectedServicoId, fx.id, 'semMob', e.target.value)}
                              onBlur={stopEditing}
                              className="bc-cell-input"
                            />
                          ) : (
                            <div
                              onClick={() => editKey(`sem:${key}`)}
                              className={`bc-cell-display${cell.semMob ? ' bc-cell-display--filled' : ''}${!isAdmin || valuesLocked ? ' bc-cell-display--readonly' : ''}`}
                              aria-label={fmt(tbc.noFurnitureAria, { servico: servicoAtual?.nome ?? '', faixa: fx.rotulo })}
                            >
                              {cell.semMob ? `R$ ${cell.semMob}` : '—'}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="bc-faixa-rowlabel">{tbc.colWithFurniture}</div>
                    {faixaRef.map((fx) => {
                      const key = selectedServicoId ? cellKey(selectedServicoId, fx.id) : '';
                      const cell = faixaPor[key] ?? { semMob: '', comMob: '' };
                      const editing = editingKey === `com:${key}`;
                      return (
                        <div key={fx.id} className="bc-faixa-cell">
                          {editing ? (
                            <input
                              type="text"
                              placeholder="0,00"
                              autoFocus
                              value={cell.comMob}
                              onChange={(e) => selectedServicoId && setCell(selectedServicoId, fx.id, 'comMob', e.target.value)}
                              onBlur={stopEditing}
                              className="bc-cell-input"
                            />
                          ) : (
                            <div
                              onClick={() => editKey(`com:${key}`)}
                              className={`bc-cell-display${cell.comMob ? ' bc-cell-display--filled' : ''}${!isAdmin || valuesLocked ? ' bc-cell-display--readonly' : ''}`}
                              aria-label={fmt(tbc.withFurnitureAria, { servico: servicoAtual?.nome ?? '', faixa: fx.rotulo })}
                            >
                              {cell.comMob ? `R$ ${cell.comMob}` : '—'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bc-percent-panel">
                  <div className="type-label">{servicoAtual?.nome}</div>
                  <div className="bc-percent-grid">
                    <div className="bc-percent-field">
                      <span className="bc-percent-field-label">{tbc.percentValue}</span>
                      {editingKey === `pct:${selectedServicoId}` ? (
                        <div className="bc-percent-inputwrap">
                          <input
                            type="text"
                            placeholder="0"
                            autoFocus
                            value={percentualAtual?.percentual ?? ''}
                            onChange={(e) => selectedServicoId && setPct(selectedServicoId, 'percentual', e.target.value)}
                            onBlur={stopEditing}
                          />
                          <span className="bc-percent-affix">%</span>
                        </div>
                      ) : (
                        <div
                          onClick={() => selectedServicoId && editKey(`pct:${selectedServicoId}`)}
                          className={`bc-cell-display${!isAdmin || valuesLocked ? ' bc-cell-display--readonly' : ''}`}
                        >
                          {percentualAtual?.percentual ? `${percentualAtual.percentual} %` : '—'}
                        </div>
                      )}
                    </div>

                    <div className="bc-percent-field">
                      <span className="bc-percent-field-label">{tbc.minValue}</span>
                      {editingKey === `min:${selectedServicoId}` ? (
                        <div className="bc-percent-inputwrap">
                          <span className="bc-percent-affix">R$</span>
                          <input
                            type="text"
                            placeholder="0,00"
                            autoFocus
                            value={percentualAtual?.minimo ?? ''}
                            onChange={(e) => selectedServicoId && setPct(selectedServicoId, 'minimo', e.target.value)}
                            onBlur={stopEditing}
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => selectedServicoId && editKey(`min:${selectedServicoId}`)}
                          className={`bc-cell-display${!isAdmin || valuesLocked ? ' bc-cell-display--readonly' : ''}`}
                        >
                          {percentualAtual?.minimo ? `R$ ${percentualAtual.minimo}` : '—'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {isAdmin && !valuesLocked && (
            <div className="imef-acoes bc-save-row">
              <Button size="md" variant="primary" disabled={put.isPending} onClick={() => setPendingSave(true)}>
                {tbc.save}
              </Button>
            </div>
          )}
        </section>
      </Card>

      <ConfirmDialog
        isOpen={pendingSave}
        onClose={() => setPendingSave(false)}
        onConfirm={async () => { await salvar(); setPendingSave(false); }}
        title={tbc.saveConfirmTitle}
        message={tbc.saveConfirmMessage}
        confirmLabel={tbc.saveConfirmButton}
        cancelLabel={tbc.dialogBack}
        isConfirming={put.isPending}
      />

      <ConfirmDialog
        isOpen={pendingModo !== null}
        onClose={() => setPendingModo(null)}
        onConfirm={confirmSwitchModo}
        title={tbc.switchModeTitle}
        message={tbc.switchModeMessage}
        confirmLabel={tbc.switchModeConfirm}
        cancelLabel={tbc.dialogBack}
      />
    </div>
  );
};
