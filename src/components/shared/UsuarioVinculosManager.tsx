import React from 'react';
import { Badge } from './DataDisplay';
import { Icon } from './Icon';
import { useUsuarioVinculos, useAddVinculo, useRemoveVinculo, useImobiliarias } from '../../api/admin';
import { useTranslation, fmt } from '../../i18n';
import './UsuarioVinculosManager.css';

/**
 * Imobiliárias vinculadas a um usuário (V25). Add/remove inline — pendencias.md § 4.
 */
export const UsuarioVinculosManager: React.FC<{ usuarioId: string; onToast: (m: string) => void }> = ({
  usuarioId,
  onToast,
}) => {
  const { t } = useTranslation();
  const tv = t.components.usuarioVinculos;
  const vinculos = useUsuarioVinculos(usuarioId);
  const add = useAddVinculo();
  const remove = useRemoveVinculo();
  const imobiliarias = useImobiliarias(undefined).data?.content ?? [];

  const vinculadas = vinculos.data ?? [];
  const nome = (id: string) => {
    const im = imobiliarias.find((x) => x.id === id);
    return im ? (im.nomeFantasia || im.razaoSocial) : fmt(tv.agencyFallback, { id });
  };
  const disponiveis = imobiliarias.filter((im) => !vinculadas.includes(im.id));

  const vincular = async (imobiliariaId: string) => {
    try {
      await add.mutateAsync({ usuarioId, imobiliariaId });
      onToast(tv.linkAdded);
    } catch (e: any) { onToast(e?.message || tv.linkAddError); }
  };

  const desvincular = async (imobiliariaId: string) => {
    try {
      await remove.mutateAsync({ usuarioId, imobiliariaId });
      onToast(tv.linkRemoved);
    } catch (e: any) { onToast(e?.message || tv.linkRemoveError); }
  };

  return (
    <div className="uvm">
      <h4 className="uvm-title">{tv.title}</h4>
      {vinculos.isLoading && <p className="uvm-text">{t.common.loading}</p>}
      {!vinculos.isLoading && vinculadas.length === 0 && (
        <p className="uvm-text">{tv.noLinks}</p>
      )}
      <div className="uvm-chips">
        {vinculadas.map((id) => (
          <span key={id} className="uvm-chip">
            <Badge tone="outline">{nome(id)}</Badge>
            <button
              type="button"
              className="uvm-remove"
              aria-label={fmt(tv.removeLink, { nome: nome(id) })}
              disabled={remove.isPending}
              onClick={() => desvincular(id)}
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>
      {disponiveis.length > 0 && (
        <div className="uvm-add">
          <select
            className="form-select"
            aria-label={tv.addAria}
            value=""
            disabled={add.isPending}
            onChange={(e) => { if (e.target.value) vincular(e.target.value); }}
          >
            <option value="">{tv.addPlaceholder}</option>
            {disponiveis.map((im) => (
              <option key={im.id} value={im.id}>{im.nomeFantasia || im.razaoSocial}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
