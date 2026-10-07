import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import './InfoHint.css';

interface InfoHintProps {
  /** Título da tela — renderizado como o próprio `h1` da página. */
  title: React.ReactNode;
  /** Rótulo do popover (e texto acessível). Ex.: "Sobre esta tela". */
  label?: string;
  /** O texto explicativo — a antiga descrição fixa/subtítulo da tela. */
  children: React.ReactNode;
  /** Alinhamento do popover em relação ao título. Default: início (esquerda). */
  align?: 'start' | 'end';
}

/**
 * Título de tela com a descrição ("Sobre esta tela") escondida num popover que
 * abre no hover ou no foco do próprio título — sem ícone "i" e sem subtítulo
 * fixo ocupando o topo do conteúdo. O default fica limpo; a explicação continua
 * a um passar de mouse (ou Tab).
 */
export const InfoHint: React.FC<InfoHintProps> = ({
  title,
  label,
  children,
  align = 'start',
}) => {
  const { t } = useTranslation();
  const hintLabel = label ?? t.components.infoHint.aboutScreen;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div
      className="info-hint"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <h1
        className={`type-h1-page info-hint-title ${open ? 'info-hint-title--on' : ''}`}
        tabIndex={0}
        aria-describedby={panelId}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {title}
      </h1>

      <div
        id={panelId}
        className={`info-hint-panel info-hint-panel--${align}`}
        role="tooltip"
        aria-label={hintLabel}
        hidden={!open}
      >
        <span className="info-hint-panel-title">{hintLabel}</span>
        <div className="info-hint-panel-body">{children}</div>
      </div>
    </div>
  );
};
