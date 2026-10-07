import React from 'react';
import { Checkbox, Input } from './Input';
import { useTranslation } from '../../i18n';

interface Props {
  /** true = "cadastro externo" marcado. */
  ativo: boolean;
  onAtivoChange: (v: boolean) => void;
  /** id_externo digitado (string; só dígitos). */
  idExterno: string;
  onIdExternoChange: (v: string) => void;
  /** Rótulo do recurso na Pleno, ex.: "cli_codigo", "imo_codigo". */
  campoLabel?: string;
}

/**
 * Bloco compartilhado do "cadastro externo (Pleno)": marca que o recurso
 * já existe na Pleno e informa o ID de lá, em vez de deixar o inspecta-worker criar.
 * O inspecta-api grava o vínculo direto (`origem='manual'`) sem publicar evento.
 */
export const PlenoCadastroExterno: React.FC<Props> = ({
  ativo,
  onAtivoChange,
  idExterno,
  onIdExternoChange,
  campoLabel,
}) => {
  const { t } = useTranslation();
  const tp = t.components.plenoCadastroExterno;
  return (
    <div className="pleno-cadastro-externo">
      <Checkbox
        label={tp.checkbox}
        checked={ativo}
        onChange={(e) => onAtivoChange(e.target.checked)}
      />
      {ativo && (
        <Input
          label={campoLabel ?? tp.idLabelDefault}
          type="text"
          inputMode="numeric"
          placeholder={tp.idPlaceholder}
          value={idExterno}
          onChange={(e) => onIdExternoChange(e.target.value.replace(/\D/g, ''))}
        />
      )}
    </div>
  );
};
