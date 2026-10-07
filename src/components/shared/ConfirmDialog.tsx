import React from 'react';
import { Dialog } from './DataDisplay';
import { Button } from './Button';
import { useTranslation } from '../../i18n';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Desabilita os botões e troca o rótulo de confirmação enquanto a exclusão está em andamento. */
  isConfirming?: boolean;
}

/**
 * Confirmação de exclusão reutilizável — casca fina sobre o {@link Dialog}
 * já existente (foco preso, fecha no Escape/overlay). Toda ação de excluir no
 * app deve passar por este componente antes de efetivar a exclusão; conectar
 * este componente aos botões de excluir de cada página fica para as passadas
 * seguintes, específicas de cada tela.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isConfirming = false,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title ?? t.components.confirmDialog.title}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
            {cancelLabel ?? t.common.cancel}
          </Button>
          <Button variant="accent" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming
              ? t.components.confirmDialog.deleting
              : confirmLabel ?? t.components.confirmDialog.confirm}
          </Button>
        </>
      }
    >
      {message}
    </Dialog>
  );
};
