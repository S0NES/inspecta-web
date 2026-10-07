import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation, fmt } from '../../i18n';
import { Icon } from './Icon';
import './DataDisplay.css';

interface CardProps {
  children: React.ReactNode;
  elevated?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, elevated, className = '' }) => (
  <div className={`card ${elevated ? 'card--elevated' : ''} ${className}`}>{children}</div>
);

interface BadgeProps {
  children: React.ReactNode;
  tone?: 'ink' | 'gray' | 'outline' | 'red';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, tone = 'gray', className = '' }) => (
  <span className={`badge badge--${tone} ${className}`}>{children}</span>
);

interface TagProps {
  children: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export const Tag: React.FC<TagProps> = ({ children, removable, onRemove, className = '' }) => {
  const { t } = useTranslation();
  return (
    <div className={`tag ${className}`}>
      <span>{children}</span>
      {removable && (
        <button className="tag--remove" onClick={onRemove} aria-label={t.common.remove}><Icon name="close" size={14} /></button>
      )}
    </div>
  );
};

interface TabsProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange, className = '' }) => (
  <div className={`tabs ${className}`}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        className={`tab ${activeTab === tab.id ? 'tab--active' : ''}`}
        onClick={() => onTabChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** `lg` alarga o modal para gráficos e tabelas largas. Default `md`. */
  size?: 'md' | 'lg';
  /**
   * Texto de ajuda ("sobre este modal") escondido atrás de um botão "i" no canto
   * superior direito, ao lado do X. Some quando não informado.
   */
  info?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md',
  info,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const infoId = useId();
  const [infoOpen, setInfoOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) setInfoOpen(false);
  }, [isOpen]);

  // onClose costuma ser um arrow inline recriado a cada render do pai; guardá-lo num ref
  // deixa o efeito abaixo depender só de `isOpen` (senão ele re-roda a cada tecla digitada
  // no diálogo e rouba o foco de volta pro primeiro campo).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement;
    const node = dialogRef.current;

    // Foco inicial no primeiro campo/botão focável (ou no próprio diálogo).
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];
    const content = node?.querySelector('.dialog-content');
    const contentFocusables = () =>
      content
        ? Array.from(
            content.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];
    (contentFocusables()[0] ?? focusables()[0] ?? node)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      // Trap de foco: Tab não sai do diálogo.
      if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
    // onClose acessado via onCloseRef de propósito — ver comentário acima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`dialog${size === 'lg' ? ' dialog--lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-header-start">
            {title && <h2 id={titleId} className="dialog-title">{title}</h2>}
            {info && (
              <div className="dialog-info">
                <button
                  type="button"
                  className="dialog-info-btn"
                  aria-label={t.components.dialog.info}
                  aria-expanded={infoOpen}
                  aria-controls={infoId}
                  onClick={() => setInfoOpen((v) => !v)}
                >
                  <Icon name="info" size={16} />
                </button>
                <div
                  id={infoId}
                  className="dialog-info-panel"
                  role="tooltip"
                  aria-label={t.components.dialog.info}
                  hidden={!infoOpen}
                >
                  <span className="dialog-info-panel-title">{t.components.dialog.info}</span>
                  <div className="dialog-info-panel-body">{info}</div>
                </div>
              </div>
            )}
          </div>
          <div className="dialog-header-end">
            <button type="button" className="dialog-close" onClick={onClose} aria-label={t.common.close}>
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
        <div className="dialog-content">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
};

interface PaginationProps {
  /** Página atual, base 0. */
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  className?: string;
}

/**
 * Rodapé de paginação padrão (Anterior / "Página X de Y" / Próxima). Some quando
 * há uma página só. Paginação client-side fica a cargo de quem chama.
 */
export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPage, className = '' }) => {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <div className={`pagination ${className}`}>
      <button
        type="button"
        className="pagination-btn"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
        {t.common.pagination.prev}
      </button>
      <span className="pagination-status">
        {fmt(t.common.pagination.pageOf, { page: page + 1, total: totalPages })}
      </span>
      <button
        type="button"
        className="pagination-btn"
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
      >
        {t.common.pagination.next}
      </button>
    </div>
  );
};

interface ToastProps {
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4200);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="toast animate-mvfade">
      <div className="toast-dot"></div>
      <span className="toast-message">{message}</span>
    </div>
  );
};

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
}) => (
  <div className={`tooltip-wrapper`}>
    {children}
    <div className={`tooltip tooltip--${position}`}>{content}</div>
  </div>
);
