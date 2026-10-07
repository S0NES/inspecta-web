import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useTranslation } from '../../i18n';
import './BackButton.css';

interface BackButtonProps {
  /** Destino do voltar. Sem valor: volta uma entrada no histórico do navegador. */
  to?: string;
  label?: string;
  /**
   * Fixa o botão no canto superior direito do container (que precisa ser
   * `position: relative`), fora do fluxo — não empurra nem encolhe o conteúdo.
   * Usado nos wizards.
   */
  corner?: boolean;
}

/**
 * Link "‹ Voltar" de uma tela de criação/edição — substitui os antigos botões
 * "Cancelar" do rodapé dos wizards. Com `corner`, flutua no canto superior direito.
 */
export const BackButton: React.FC<BackButtonProps> = ({ to, label, corner }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`back-button${corner ? ' back-button--corner' : ''}`}
      onClick={() => (to ? navigate(to) : navigate(-1))}
    >
      <Icon name="chevron-left" size={16} />
      {label ?? t.common.back}
    </button>
  );
};
