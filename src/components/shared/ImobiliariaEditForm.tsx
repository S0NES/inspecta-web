import React, { useMemo, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';
import { useServicos } from '../../api/servicos';
import {
  useImobiliariaContrato,
  usePutContrato,
  usePutContratoGrupos,
  usePutContratoFaixas,
  FAIXAS_REFERENCIA,
  type ContratoModo,
  type ContratoGrupo,
  type ContratoFaixaValor,
} from '../../api/contratos';
import { useTranslation, fmt } from '../../i18n';
import './ImobiliariaEditForm.css';

// Biletagem — tipo único por imobiliária, valores por Produto.
//
// V3: os dados básicos (razão social, financeiro, template de laudo) e o
// "Salvar" migraram para a tela `Agency` (modo edição). Esta seção continua
// aqui — self-contained, só precisa de `imobiliariaId` — e é reusada de lá.

interface PercentualForm { percentual: string; minimo: string; }
interface FaixaCell { valorSemMobilia: string; valorComMobilia: string; paStepMetragem: string; paStepValor: string; }

const key = (servicoId: string, faixaId: string) => `${servicoId}:${faixaId}`;

export interface BiletagemDraft {
  modo: ContratoModo;
  percentualMinimo: number | null;
  grupos: ContratoGrupo[];
  faixas: ContratoFaixaValor[];
}

export const BiletagemSection: React.FC<{
  imobiliariaId?: string | null;
  onToast?: (m: string) => void;
  showSaveButton?: boolean;
  onDraftChange?: (draft: BiletagemDraft) => void;
}> = ({
  imobiliariaId = null,
  onToast,
  showSaveButton,
  onDraftChange,
}) => {
  const { t } = useTranslation();
  const tb = t.components.biletagem;
  const contratoQuery = useImobiliariaContrato(imobiliariaId);
  const servicosQuery = useServicos();
  const putContrato = usePutContrato();
  const putGrupos = usePutContratoGrupos();
  const putFaixas = usePutContratoFaixas();

  const servicos = (servicosQuery.data ?? []).filter((s) => s.ativo);
  const contrato = contratoQuery.data;

  // Rótulos/intervalos das faixas vêm do backend (`faixaReferencia`); só cai no
  // fallback local quando o array está ausente/vazio.
  const faixaRef = useMemo(() => {
    const fromApi = contrato?.faixaReferencia;
    const base = fromApi && fromApi.length > 0 ? fromApi : FAIXAS_REFERENCIA;
    return [...base].sort((a, b) => a.ordem - b.ordem);
  }, [contrato?.faixaReferencia]);

  const [modo, setModo] = useState<ContratoModo>('faixa');
  const [percentualGlobalMin, setPercentualGlobalMin] = useState('');
  const [servicoIds, setServicoIds] = useState<string[]>([]);
  const [percentualPor, setPercentualPor] = useState<Record<string, PercentualForm>>({});
  const [faixaPor, setFaixaPor] = useState<Record<string, FaixaCell>>({});
  const [hidratado, setHidratado] = useState(!imobiliariaId);

  // Hidrata o form uma vez. Sem imobiliária (cadastro) começa vazio e já hidratado.
  // Com imobiliária, espera o GET; 404/erro = rascunho vazio, não trava o draft.
  React.useEffect(() => {
    if (hidratado) return;
    if (imobiliariaId && contratoQuery.isLoading) return;
    if (contrato) {
      setModo(contrato.modo);
      setPercentualGlobalMin(contrato.percentualMinimo != null ? String(contrato.percentualMinimo) : '');
      setServicoIds(contrato.grupos.map((g) => g.servicoId));
      setPercentualPor(
        Object.fromEntries(
          contrato.grupos.map((g) => [
            g.servicoId,
            {
              percentual: g.percentual != null ? String(g.percentual) : '',
              minimo: g.percentualMinimo != null ? String(g.percentualMinimo) : '',
            },
          ]),
        ),
      );
      setFaixaPor(
        Object.fromEntries(
          contrato.faixas.map((f) => [
            key(f.servicoId, f.faixaId),
            {
              valorSemMobilia: f.valorSemMobilia != null ? String(f.valorSemMobilia) : '',
              valorComMobilia: f.valorComMobilia != null ? String(f.valorComMobilia) : '',
              paStepMetragem: f.paStepMetragem != null ? String(f.paStepMetragem) : '',
              paStepValor: f.paStepValor != null ? String(f.paStepValor) : '',
            },
          ]),
        ),
      );
    }
    setHidratado(true);
  }, [contrato, hidratado, imobiliariaId, contratoQuery.isLoading]);

  const toggleServico = (id: string) =>
    setServicoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const setPct = (id: string, k: keyof PercentualForm, v: string) =>
    setPercentualPor((p) => {
      const cur: PercentualForm = p[id] ?? { percentual: '', minimo: '' };
      return { ...p, [id]: { ...cur, [k]: v } };
    });

  const setCell = (servicoId: string, faixaId: string, k: keyof FaixaCell, v: string) =>
    setFaixaPor((p) => {
      const cur: FaixaCell = p[key(servicoId, faixaId)] ?? {
        valorSemMobilia: '', valorComMobilia: '', paStepMetragem: '', paStepValor: '',
      };
      return { ...p, [key(servicoId, faixaId)]: { ...cur, [k]: v } };
    });

  const num = (s: string): number | null => {
    const n = Number(s.replace(',', '.'));
    return s.trim() === '' || Number.isNaN(n) ? null : n;
  };

  const montarDraft = (): BiletagemDraft => {
    const grupos: ContratoGrupo[] = servicoIds.map((servicoId) => ({
      servicoId,
      percentual: modo === 'percentual' ? num(percentualPor[servicoId]?.percentual ?? '') : null,
      percentualMinimo: modo === 'percentual' ? num(percentualPor[servicoId]?.minimo ?? '') : null,
    }));
    const faixas: ContratoFaixaValor[] = [];
    if (modo === 'faixa') {
      for (const servicoId of servicoIds) {
        for (const fx of faixaRef) {
          const cell = faixaPor[key(servicoId, fx.id)];
          if (!cell) continue;
          const ultima = fx.metragemMax == null;
          faixas.push({
            servicoId,
            faixaId: fx.id,
            valorSemMobilia: num(cell.valorSemMobilia),
            valorComMobilia: num(cell.valorComMobilia),
            paStepMetragem: ultima ? (num(cell.paStepMetragem) ?? 75) : null,
            paStepValor: ultima ? num(cell.paStepValor) : null,
          });
        }
      }
    }
    return { modo, percentualMinimo: num(percentualGlobalMin), grupos, faixas };
  };

  React.useEffect(() => {
    if (!hidratado) return;
    onDraftChange?.(montarDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado, modo, percentualGlobalMin, servicoIds, percentualPor, faixaPor, faixaRef]);

  const salvarBiletagem = async () => {
    if (!imobiliariaId) return;
    try {
      const draft = montarDraft();
      await putContrato.mutateAsync({
        imobiliariaId,
        modo: draft.modo,
        percentualMinimo: draft.percentualMinimo,
      });

      await putGrupos.mutateAsync({ imobiliariaId, grupos: draft.grupos });

      if (draft.modo === 'faixa') {
        await putFaixas.mutateAsync({ imobiliariaId, faixas: draft.faixas });
      }

      onToast?.(tb.saved);
    } catch (e: any) {
      onToast?.(e?.message || tb.saveError);
    }
    setTimeout(() => onToast?.(''), 3500);
  };

  const podeSalvar = showSaveButton ?? !!imobiliariaId;

  const salvando = putContrato.isPending || putGrupos.isPending || putFaixas.isPending;
  const servicoNome = useMemo(
    () => (id: string) => servicos.find((s) => s.id === id)?.nome ?? fmt(tb.serviceFallback, { id }),
    [servicos, tb.serviceFallback],
  );

  return (
    <section className="imef-biletagem" aria-label={tb.aria}>
      <h3 className="imef-biletagem-titulo">{tb.title}</h3>
      {imobiliariaId && contratoQuery.isError && (
        <p className="imef-biletagem-aviso">{tb.contractLoadError}</p>
      )}

      <div className="imef-eyebrow">{tb.typeEyebrow}</div>
      <div className="imef-radio-cards">
        {([
          { id: 'faixa', icon: 'properties', titulo: tb.rangeMode, desc: tb.rangeModeDesc },
          { id: 'percentual', icon: 'extrato', titulo: tb.percentMode, desc: tb.percentModeDesc },
        ] as const).map((opt) => (
          <label
            key={opt.id}
            className={`imef-radio-card ${modo === opt.id ? 'imef-radio-card--on' : ''}`}
          >
            <input
              type="radio"
              className="imef-radio-card-input"
              name={`biletagem-modo-${imobiliariaId ?? 'novo'}`}
              checked={modo === opt.id}
              onChange={() => setModo(opt.id)}
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

      {modo === 'percentual' && (
        <Input
          label={tb.globalMinLabel}
          type="number"
          inputMode="decimal"
          value={percentualGlobalMin}
          onChange={(e) => setPercentualGlobalMin(e.target.value)}
        />
      )}

      <div className="imef-eyebrow">{tb.servicesEyebrow}</div>
      {servicos.length === 0 ? (
        <p className="imef-biletagem-aviso">{tb.noServices}</p>
      ) : (
        <div className="imef-pills">
          {servicos.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`imef-pill ${servicoIds.includes(s.id) ? 'imef-pill--on' : ''}`}
              aria-pressed={servicoIds.includes(s.id)}
              onClick={() => toggleServico(s.id)}
            >
              {s.nome}
            </button>
          ))}
        </div>
      )}

      {servicoIds.map((servicoId) => (
        <div key={servicoId} className="imef-servico-valores">
          <div className="imef-eyebrow">{servicoNome(servicoId)}</div>

          {modo === 'percentual' ? (
            <div className="imef-grid">
              <Input
                label={tb.percentOfRent}
                type="number"
                inputMode="decimal"
                value={percentualPor[servicoId]?.percentual ?? ''}
                onChange={(e) => setPct(servicoId, 'percentual', e.target.value)}
              />
              <Input
                label={tb.minValue}
                type="number"
                inputMode="decimal"
                value={percentualPor[servicoId]?.minimo ?? ''}
                onChange={(e) => setPct(servicoId, 'minimo', e.target.value)}
              />
            </div>
          ) : (
            <div className="imef-faixa-tabela-wrap">
              <table className="imef-faixa-tabela">
                <thead>
                  <tr>
                    <th>{tb.colFaixa}</th>
                    <th>{tb.colNoFurniture}</th>
                    <th>{tb.colWithFurniture}</th>
                  </tr>
                </thead>
                <tbody>
                  {faixaRef.map((fx) => {
                    const cell = faixaPor[key(servicoId, fx.id)] ?? {
                      valorSemMobilia: '', valorComMobilia: '', paStepMetragem: '', paStepValor: '',
                    };
                    return (
                      <React.Fragment key={fx.id}>
                        <tr>
                          <td>{fx.rotulo}</td>
                          <td>
                            <input
                              className="form-input"
                              type="number"
                              aria-label={fmt(tb.noFurnitureAria, { rotulo: fx.rotulo })}
                              value={cell.valorSemMobilia}
                              onChange={(e) => setCell(servicoId, fx.id, 'valorSemMobilia', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="form-input"
                              type="number"
                              aria-label={fmt(tb.withFurnitureAria, { rotulo: fx.rotulo })}
                              value={cell.valorComMobilia}
                              onChange={(e) => setCell(servicoId, fx.id, 'valorComMobilia', e.target.value)}
                            />
                          </td>
                        </tr>
                        {fx.metragemMax == null && (
                          <tr className="imef-faixa-step">
                            <td>{tb.incrementRow}</td>
                            <td>
                              <input
                                className="form-input"
                                type="number"
                                aria-label={tb.stepMetragemAria}
                                placeholder="75"
                                value={cell.paStepMetragem || '75'}
                                onChange={(e) => setCell(servicoId, fx.id, 'paStepMetragem', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                type="number"
                                aria-label={tb.stepValueAria}
                                placeholder="Z"
                                value={cell.paStepValor}
                                onChange={(e) => setCell(servicoId, fx.id, 'paStepValor', e.target.value)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {podeSalvar && (
        <div className="imef-acoes">
          <Button size="sm" variant="primary" disabled={salvando} onClick={salvarBiletagem}>
            {salvando ? tb.saving : tb.save}
          </Button>
        </div>
      )}
    </section>
  );
};
