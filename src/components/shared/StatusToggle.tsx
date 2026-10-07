import React from 'react';
import { Badge } from './DataDisplay';
import { useTranslation, fmt } from '../../i18n';
import './StatusToggle.css';

interface StatusToggleProps {
  /** Estado atual do registro. */
  active: boolean;
  /** Alterna o estado (o componente não controla loading — passe `disabled`). */
  onToggle: () => void;
  disabled?: boolean;
  /** Substantivo do registro para o rótulo acessível: "imóvel", "imobiliária"… */
  noun: string;
}

/**
 * Selo de status que também alterna o estado ao clicar. Em repouso mostra
 * "Ativo"/"Inativo" (mesmo Badge das tabelas); no hover/foco troca para o verbo
 * ("Inativar"/"Ativar") — mesmo padrão do chip de reenviar convite. As duas
 * legendas ocupam a mesma célula de grid, então a largura não pula.
 */
export const StatusToggle: React.FC<StatusToggleProps> = ({ active, onToggle, disabled, noun }) => {
  const { t } = useTranslation();
  const st = t.components.statusToggle;
  const acao = active ? fmt(st.deactivate, { noun }) : fmt(st.activate, { noun });
  return (
    <button
      type="button"
      className="status-toggle"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      aria-label={acao}
      title={acao}
    >
      <span className="status-toggle__face status-toggle__face--idle">
        <Badge tone={active ? 'ink' : 'gray'}>{active ? st.active : st.inactive}</Badge>
      </span>
      <span className="status-toggle__face status-toggle__face--hover" aria-hidden="true">
        {active ? st.deactivateShort : st.activateShort}
      </span>
    </button>
  );
};
