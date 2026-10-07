import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useTranslation } from '../../i18n';
import './FieldHint.css';

interface FieldHintProps {
  /** Texto de ajuda revelado no hover/foco do botão "i". */
  children: React.ReactNode;
  /** Rótulo acessível do botão. Default: "Ajuda". */
  label?: string;
  /** `error`: ícone sempre vermelho (sinaliza um problema, não só ajuda). */
  tone?: 'default' | 'error';
}

/**
 * Botão "i" ao lado de um rótulo de campo — a dica sai do fluxo do formulário e
 * aparece num tooltip ao passar o mouse ou focar o botão. Mesmo idioma visual do
 * {@link InfoHint} de tela, mas em escala de campo.
 */
export const FieldHint: React.FC<FieldHintProps> = ({ children, label, tone = 'default' }) => {
  const { t } = useTranslation();
  const hintLabel = label ?? t.components.fieldHint.label;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <span
      className="field-hint"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`field-hint-btn${tone === 'error' ? ' field-hint-btn--error' : ''}`}
        aria-label={hintLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Icon name="info" size={13} />
      </button>
      <span id={panelId} className="field-hint-panel" role="tooltip" hidden={!open}>
        {children}
      </span>
    </span>
  );
};
