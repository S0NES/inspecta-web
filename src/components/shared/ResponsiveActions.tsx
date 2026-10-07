import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';
import { useTranslation } from '../../i18n';
import './ResponsiveActions.css';

export interface ActionSpec {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  /** No menu colapsado, marca o item com o acento vermelho. */
  danger?: boolean;
}

interface ResponsiveActionsProps {
  /** Ação principal — sempre um botão, nunca entra no menu. Fica à direita. */
  primary?: ActionSpec;
  /** Ações secundárias — viram um menu "+" quando a janela fica estreita. */
  secondary?: ActionSpec[];
  /** Largura de viewport (px) abaixo da qual as secundárias colapsam. Default 900. */
  collapseBelow?: number;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * matchMedia com guarda para ambientes sem a API (jsdom nos testes) — nesses
 * casos assume "tela larga", então tudo aparece expandido.
 */
function useViewportBelow(px: number): boolean {
  const query = `(max-width: ${px}px)`;
  const [below, setBelow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const sync = () => setBelow(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, [query]);

  return below;
}

/**
 * Cluster de ações de cabeçalho com prioridade responsiva: a ação primária fica
 * sempre visível à direita; as secundárias aparecem como botões quando há espaço
 * e colapsam para um menu "+" quando a janela estreita — em vez de todos os
 * botões encolherem e quebrarem rótulo. Usa {@link ActionMenu} para o menu.
 */
export const ResponsiveActions: React.FC<ResponsiveActionsProps> = ({
  primary,
  secondary = [],
  collapseBelow = 900,
  size = 'md',
  className = '',
}) => {
  const { t } = useTranslation();
  const collapsed = useViewportBelow(collapseBelow);

  const renderButton = (a: ActionSpec, fallbackVariant: ActionSpec['variant']) => (
    <Button
      key={a.key}
      variant={a.variant ?? fallbackVariant}
      size={size}
      disabled={a.disabled}
      onClick={a.onClick}
    >
      {a.label}
    </Button>
  );

  const menuItems: ActionMenuItem[] = secondary.map((a) => ({
    key: a.key,
    label: a.label,
    onClick: a.onClick,
    disabled: a.disabled,
    danger: a.danger,
  }));

  const showMenu = collapsed && secondary.length > 0;

  return (
    <div className={`responsive-actions ${className}`}>
      {!collapsed && secondary.map((a) => renderButton(a, 'secondary'))}
      {showMenu && <ActionMenu items={menuItems} size={size} label={t.common.moreActions} />}
      {primary && renderButton(primary, 'primary')}
    </div>
  );
};
