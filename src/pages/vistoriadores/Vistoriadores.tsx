import React, { useState } from 'react';
import { Card, Badge } from '../../components/shared/DataDisplay';
import { InfoHint } from '../../components/shared/InfoHint';
import { useAppStore } from '../../store/useAppStore';
import { useVistoriadores, usePatchVistoriador } from '../../api/vistoriadores';
import { useUsuarios } from '../../api/admin';
import { useCidades } from '../../api/imoveis';
import { DisponibilidadeEditor } from '../../components/shared/DisponibilidadeEditor';
import { useTranslation, fmt } from '../../i18n';
import './Vistoriadores.css';

interface VistoriadoresProps {
  /** Renderizado como aba dentro de Clientes: a tela mãe já dá o título/contexto. */
  embedded?: boolean;
}

export const Vistoriadores: React.FC<VistoriadoresProps> = ({ embedded = false }) => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tv = t.vistoriadores;
  const vistoriadoresQuery = useVistoriadores();
  const usuarios = useUsuarios({ size: 200 }).data?.content ?? [];
  const cidades = useCidades().data ?? [];
  const patch = usePatchVistoriador();

  const [expandido, setExpandido] = useState<string | null>(null);

  const usuario = (id: string) => usuarios.find((u) => u.id === id);
  const cidadeNome = (id: string) => {
    const c = cidades.find((x) => x.id === id);
    return c ? `${c.nome}/${c.uf}` : fmt(tv.cityFallback, { id });
  };

  // Só vistoriadores de verdade: o backend às vezes devolve uma linha para um
  // usuário que hoje tem outro perfil (ex.: Operação). Sem registro de usuário
  // carregado, mantém a linha para não sumir com um vistoriador legítimo.
  const lista = (vistoriadoresQuery.data ?? []).filter((v) => {
    const u = usuario(v.usuarioId);
    return !u || u.perfil === 'vistoriador';
  });

  const toggleAtivo = async (id: string, ativo: boolean) => {
    try {
      await patch.mutateAsync({ id, ativo: !ativo });
      setToast(!ativo ? tv.activated : tv.deactivated);
    } catch (e: any) {
      setToast(e?.message || tv.updateError);
    }
    setTimeout(() => setToast(null), 3000);
  };

  const toggleCidade = async (v: { id: string; cidades: string[] | null }, cidadeId: string) => {
    const atual = v.cidades ?? [];
    const nova = atual.includes(cidadeId) ? atual.filter((c) => c !== cidadeId) : [...atual, cidadeId];
    try {
      await patch.mutateAsync({ id: v.id, cidades: nova });
    } catch (e: any) {
      setToast(e?.message || tv.cityUpdateError);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const setRaio = async (id: string, valor: string) => {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await patch.mutateAsync({ id, distanciaMaxKm: n });
    } catch (e: any) {
      setToast(e?.message || tv.genericError); setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className={`vist-container ${embedded ? 'vist-container--embedded' : ''}`}>
      {!embedded && (
        <div className="vist-header">
          <div className="vist-title">
            <InfoHint title={t.nav.items.vistoriadores}>
              <p>
                {tv.hintTitlePrefix}<strong>{tv.hintTitleBold}</strong>{tv.hintTitleSuffix}
              </p>
              <p>{tv.hintP2}</p>
            </InfoHint>
          </div>
        </div>
      )}

      <Card>
        {vistoriadoresQuery.isLoading && <p className="vist-empty">{tv.loading}</p>}
        {vistoriadoresQuery.error && <p className="vist-empty">{tv.loadError}</p>}
        {!vistoriadoresQuery.isLoading && lista.length === 0 && (
          <p className="vist-empty">{tv.empty}</p>
        )}
        {lista.map((v) => {
          const u = usuario(v.usuarioId);
          const pracas = v.cidades ?? [];
          return (
            <div key={v.id} className="vist-item">
              <div
                className="vist-item-head"
                role="button"
                tabIndex={0}
                aria-expanded={expandido === v.id}
                onClick={() => setExpandido(expandido === v.id ? null : v.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandido(expandido === v.id ? null : v.id);
                  }
                }}
              >
                <div>
                  <strong>{u?.nome ?? fmt(tv.fallbackName, { id: v.id })}</strong>
                  <span className="vist-item-meta">
                    {u?.email ?? '—'} · {fmt(tv.metaAreas, { n: pracas.length })}
                    {v.plenoId && fmt(tv.metaPleno, { id: v.plenoId })}
                  </span>
                </div>
                <button
                  type="button"
                  className="vist-toggle"
                  aria-label={v.ativo ? tv.deactivate : tv.activate}
                  aria-pressed={v.ativo}
                  onClick={(e) => { e.stopPropagation(); toggleAtivo(v.id, v.ativo); }}
                  disabled={patch.isPending}
                >
                  <Badge tone={v.ativo ? 'ink' : 'gray'}>{v.ativo ? tv.statusActive : tv.statusInactive}</Badge>
                </button>
              </div>

              {expandido === v.id && (
                <div className="vist-detail">
                  <div className="vist-block">
                    <h4>{tv.areasTitle}</h4>
                    <div className="vist-cidade-grid">
                      {cidades.map((c) => (
                        <label key={c.id} className="vist-cidade">
                          <input
                            type="checkbox"
                            checked={pracas.includes(c.id)}
                            onChange={() => toggleCidade(v, c.id)}
                          />
                          <span>{c.nome}/{c.uf}</span>
                        </label>
                      ))}
                      {cidades.length === 0 && <p className="vist-empty">{tv.noCitiesRegistered}</p>}
                    </div>
                  </div>
                  <div className="vist-block">
                    <h4>{tv.radiusTitle}</h4>
                    <input
                      type="number"
                      className="form-input vist-raio"
                      aria-label={tv.radiusAria}
                      defaultValue={v.distanciaMaxKm ?? ''}
                      placeholder={tv.radiusPlaceholder}
                      onBlur={(e) => setRaio(v.id, e.target.value)}
                    />
                  </div>
                  {pracas.length > 0 && (
                    <p className="vist-pracas-resumo">{pracas.map(cidadeNome).join(' · ')}</p>
                  )}
                  <div className="vist-block">
                    <DisponibilidadeEditor
                      vistoriadorId={v.id}
                      onToast={(m) => { setToast(m); setTimeout(() => setToast(null), 3000); }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
};
