import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n';
import { Icon } from './Icon';
import './ActionMenu.css';

export interface ActionMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Renderiza o item com o acento vermelho (desativar, remover…). */
  danger?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Ícone do gatilho. `plus` no cluster de ações; `ellipsis-vertical` nos menus de linha. */
  trigger?: React.ReactNode;
  /** Rótulo acessível do gatilho. */
  label?: string;
  /** Lado em que o menu abre. Default: fim (direita). */
  align?: 'start' | 'end';
  /** Tamanho do botão-gatilho. */
  size?: 'sm' | 'md';
}

const VIEWPORT_PAD = 8;
const TRIGGER_GAP = 8;

/**
 * Botão de ícone que abre uma lista de ações num menu — o padrão de "estouro"
 * do sistema (mesma mecânica de foco/fecha do {@link FilterPopover} e visual do
 * menu de perfil da barra lateral). Usado tanto para as ações secundárias que
 * colapsam quando falta largura quanto para menus de ação por linha.
 *
 * O painel é portado para `document.body` com `position: fixed` para não ser
 * recortado por ancestrais com `overflow` (tabelas paginadas).
 */
export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  trigger = <Icon name="plus" />,
  label,
  align = 'end',
  size = 'md',
}) => {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t.common.moreActions;
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const placeMenu = () => {
      const triggerEl = triggerRef.current;
      const menuEl = menuRef.current;
      if (!triggerEl || !menuEl) return;

      const rect = triggerEl.getBoundingClientRect();
      const menuWidth = menuEl.offsetWidth;
      const menuHeight = menuEl.offsetHeight;

      let top = rect.bottom + TRIGGER_GAP;
      if (top + menuHeight > window.innerHeight - VIEWPORT_PAD && rect.top - TRIGGER_GAP - menuHeight >= VIEWPORT_PAD) {
        top = rect.top - TRIGGER_GAP - menuHeight;
      }

      let left = align === 'end' ? rect.right - menuWidth : rect.left;
      left = Math.min(Math.max(VIEWPORT_PAD, left), window.innerWidth - menuWidth - VIEWPORT_PAD);

      setCoords({ top, left });
    };

    placeMenu();
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)'
    );
    firstItem?.focus();

    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className={`action-menu action-menu--${size}`} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`action-menu-trigger ${open ? 'action-menu-trigger--on' : ''}`}
        aria-label={resolvedLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={resolvedLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{trigger}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className={`action-menu-list action-menu-list--${align}`}
            role="menu"
            style={
              coords
                ? { top: coords.top, left: coords.left }
                : { visibility: 'hidden', top: 0, left: 0 }
            }
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`action-menu-item ${item.danger ? 'action-menu-item--danger' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
