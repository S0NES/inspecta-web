import React, { useState } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { Dialog } from './DataDisplay';
import { useTranslation } from '../../i18n';
import './FilterPopover.css';

interface FilterPopoverProps {
  /** Quantos filtros estão ativos — vira um contador no botão. */
  activeCount?: number;
  /** Conteúdo do modal: os controles de filtro da tela. */
  children: React.ReactNode;
  /** Limpa todos os filtros. Ausente, o botão de limpar não aparece. */
  onClear?: () => void;
  /** Título do modal. Default: "Filtros". */
  title?: string;
  /** Rótulo visível do botão. Default: "Filtros". */
  label?: string;
}

/**
 * Botão "Filtros" (rótulo + ícone de funil) que abre os filtros da tela num
 * modal — o mesmo {@link Dialog} das demais telas (foco preso, fecha no
 * Escape/overlay). Concentra os filtros num só ponto em vez de espalhá-los pela
 * barra, e o contador mantém visível quantos estão ativos com o modal fechado.
 */
export const FilterPopover: React.FC<FilterPopoverProps> = ({
  activeCount = 0,
  children,
  onClear,
  title,
  label,
}) => {
  const { t } = useTranslation();
  const fp = t.components.filterPopover;
  const heading = title ?? fp.title;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        className={`filter-trigger${activeCount > 0 ? ' filter-trigger--active' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="funnel" size={14} /> {label ?? fp.title}
        {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
      </Button>

      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={heading}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => onClear?.()}
              disabled={!onClear || activeCount === 0}
            >
              {fp.clear}
            </Button>
            <Button variant="accent" onClick={() => setOpen(false)}>
              {fp.apply}
            </Button>
          </>
        }
      >
        <div className="filter-panel-body">{children}</div>
      </Dialog>
    </>
  );
};
