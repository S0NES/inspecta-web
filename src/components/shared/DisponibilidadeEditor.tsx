import React, { useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import {
  useDisponibilidade,
  useExcecoes,
  useAddSlot,
  useRemoveSlot,
  useAddExcecao,
  useRemoveExcecao,
} from '../../api/vistoriadores';
import { useTranslation, fmt } from '../../i18n';
import './DisponibilidadeEditor.css';

/**
 * Grade de disponibilidade semanal + exceções (folgas/bloqueios) de um vistoriador
 * (pendencias.md § 4). Consome os endpoints de `/v1/vistoriadores/{id}/disponibilidade`
 * e `/excecoes`.
 */
export const DisponibilidadeEditor: React.FC<{ vistoriadorId: string; onToast: (m: string) => void }> = ({
  vistoriadorId,
  onToast,
}) => {
  const { t } = useTranslation();
  const td = t.components.disponibilidade;
  const DIAS = td.weekdays;
  const slots = useDisponibilidade(vistoriadorId);
  const excecoes = useExcecoes(vistoriadorId);
  const addSlot = useAddSlot();
  const removeSlot = useRemoveSlot();
  const addExcecao = useAddExcecao();
  const removeExcecao = useRemoveExcecao();

  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState('08:00');
  const [fim, setFim] = useState('12:00');

  const [exTipo, setExTipo] = useState<'ferias' | 'bloqueio'>('ferias');
  const [exIni, setExIni] = useState('');
  const [exFim, setExFim] = useState('');

  const adicionarSlot = async () => {
    if (fim <= inicio) { onToast(td.endAfterStart); return; }
    try {
      await addSlot.mutateAsync({ vistoriadorId, diaSemana: dia, horaInicio: inicio, horaFim: fim });
      onToast(td.slotAdded);
    } catch (e: any) { onToast(e?.message || td.slotAddError); }
  };

  const adicionarExcecao = async () => {
    if (!exIni || !exFim || exFim < exIni) { onToast(td.validPeriod); return; }
    try {
      await addExcecao.mutateAsync({ vistoriadorId, tipo: exTipo, dataInicio: exIni, dataFim: exFim });
      onToast(td.exceptionAdded);
      setExIni(''); setExFim('');
    } catch (e: any) { onToast(e?.message || td.exceptionAddError); }
  };

  const removerSlot = async (slotId: string) => {
    try {
      await removeSlot.mutateAsync({ vistoriadorId, slotId });
    } catch (e: any) { onToast(e?.message || td.slotRemoveError); }
  };

  const removerExcecao = async (excecaoId: string) => {
    try {
      await removeExcecao.mutateAsync({ vistoriadorId, excecaoId });
    } catch (e: any) { onToast(e?.message || td.exceptionRemoveError); }
  };

  return (
    <div className="dispe">
      <div className="dispe-block">
        <h4 className="dispe-title">{td.weeklyTitle}</h4>
        {slots.isLoading && <p className="dispe-text">{t.common.loading}</p>}
        {!slots.isLoading && (slots.data ?? []).length === 0 && (
          <p className="dispe-text">{td.noSlots}</p>
        )}
        <ul className="dispe-list">
          {(slots.data ?? []).map((s) => (
            <li key={s.id} className="dispe-row">
              <span className="dispe-mono">{DIAS[s.diaSemana]} · {s.horaInicio}–{s.horaFim}</span>
              <button
                type="button"
                className="dispe-remove"
                aria-label={fmt(td.removeSlot, { dia: DIAS[s.diaSemana] })}
                disabled={removeSlot.isPending}
                onClick={() => removerSlot(s.id)}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <div className="dispe-form">
          <select aria-label={td.weekdayAria} className="form-select" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input aria-label={td.startAria} type="time" className="form-input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <input aria-label={td.endAria} type="time" className="form-input" value={fim} onChange={(e) => setFim(e.target.value)} />
          <Button size="sm" variant="secondary" disabled={addSlot.isPending} onClick={adicionarSlot}>{td.addSlot}</Button>
        </div>
      </div>

      <div className="dispe-block">
        <h4 className="dispe-title">{td.exceptionsTitle}</h4>
        {excecoes.isLoading && <p className="dispe-text">{t.common.loading}</p>}
        {!excecoes.isLoading && (excecoes.data ?? []).length === 0 && (
          <p className="dispe-text">{td.noExceptions}</p>
        )}
        <ul className="dispe-list">
          {(excecoes.data ?? []).map((x) => (
            <li key={x.id} className="dispe-row">
              <span className="dispe-mono">
                {x.tipo === 'ferias' ? td.dayOff : td.block} · {x.dataInicio} a {x.dataFim}
              </span>
              <button
                type="button"
                className="dispe-remove"
                aria-label={td.removeException}
                disabled={removeExcecao.isPending}
                onClick={() => removerExcecao(x.id)}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <div className="dispe-form">
          <select aria-label={td.exceptionTypeAria} className="form-select" value={exTipo} onChange={(e) => setExTipo(e.target.value as 'ferias' | 'bloqueio')}>
            <option value="ferias">{td.dayOff}</option>
            <option value="bloqueio">{td.block}</option>
          </select>
          <input aria-label={td.exStartAria} type="date" className="form-input" value={exIni} onChange={(e) => setExIni(e.target.value)} />
          <input aria-label={td.exEndAria} type="date" className="form-input" value={exFim} onChange={(e) => setExFim(e.target.value)} />
          <Button size="sm" variant="secondary" disabled={addExcecao.isPending} onClick={adicionarExcecao}>{td.addException}</Button>
        </div>
      </div>
    </div>
  );
};
