import React, { useState } from 'react';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';
import { Icon } from './Icon';
import { useTranslation } from '../../i18n';
import './Table.css';

export interface TableColumn<T> {
  /** Chave usada para ler o valor padrão da linha (`row[key]`) e como `key` do React. */
  key: string;
  /** Rótulo exibido no cabeçalho da coluna. */
  label: string;
  /** Renderização customizada da célula. Sem isto, usa `String(row[key] ?? '')`. */
  render?: (row: T) => React.ReactNode;
  /** Largura da coluna na grade (qualquer valor válido de `grid-template-columns`). Default `1fr`. */
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  /** Definição das colunas, na ordem em que devem aparecer. */
  columns: TableColumn<T>[];
  data: T[];
  /** Extrai um identificador estável de cada linha (chave React, seleção, expansão). */
  rowKey: (row: T) => string;
  /** Painel de detalhe exibido ao expandir a linha. Sem isto, a linha não expande. */
  renderDetail?: (row: T) => React.ReactNode;
  /** Ações por linha, expostas atrás do menu de ação (ellipsis-vertical). */
  getActions?: (row: T) => ActionMenuItem[];
  /** Habilita seleção de linha (fundo vermelho a 25% de opacidade). */
  selectable?: boolean;
  selectedRowKey?: string | null;
  onSelectRow?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

/**
 * Tabela compartilhada: as páginas fornecem dados, colunas (ordem + rótulo) e,
 * opcionalmente, um renderizador de detalhe por linha e uma lista de ações por
 * linha (exibidas atrás do `ActionMenu` já existente). Linha selecionada usa
 * vermelho a 25% de opacidade; o painel de detalhe expandido usa o cinza neutro.
 */
export function Table<T>({
  columns,
  data,
  rowKey,
  renderDetail,
  getActions,
  selectable = false,
  selectedRowKey = null,
  onSelectRow,
  emptyMessage,
  className = '',
}: TableProps<T>) {
  const { t } = useTranslation();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const gridTemplateColumns = [
    ...columns.map((c) => c.width ?? '1fr'),
    ...(getActions ? ['auto'] : []),
  ].join(' ');

  const handleRowActivate = (row: T, key: string) => {
    if (renderDetail) toggleExpanded(key);
    if (selectable) onSelectRow?.(row);
  };

  return (
    <div className={`mv-table ${className}`}>
      <div className="mv-table-header" style={{ gridTemplateColumns }}>
        {columns.map((col) => (
          <div
            key={col.key}
            className={`mv-table-header-cell mv-table-cell--${col.align ?? 'left'}`}
          >
            {col.label}
          </div>
        ))}
        {getActions && <div className="mv-table-header-cell mv-table-header-cell--actions" aria-hidden="true" />}
      </div>

      {data.length === 0 && (
        <div className="mv-table-empty">{emptyMessage ?? t.components.table.empty}</div>
      )}

      {data.map((row) => {
        const key = rowKey(row);
        const expanded = expandedKeys.has(key);
        const selected = selectable && selectedRowKey === key;
        const activatable = Boolean(renderDetail) || selectable;

        return (
          <div key={key} className="mv-table-row-wrapper">
            <div
              className={`mv-table-row ${selected ? 'mv-table-row--selected' : ''}`}
              style={{ gridTemplateColumns }}
              onClick={activatable ? () => handleRowActivate(row, key) : undefined}
              onKeyDown={
                activatable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowActivate(row, key);
                      }
                    }
                  : undefined
              }
              role={activatable ? 'button' : undefined}
              tabIndex={activatable ? 0 : undefined}
              aria-expanded={renderDetail ? expanded : undefined}
              aria-selected={selectable ? selected : undefined}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  className={`mv-table-cell mv-table-cell--${col.align ?? 'left'}`}
                >
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </div>
              ))}

              {getActions && (
                <div className="mv-table-cell mv-table-cell--actions" onClick={(e) => e.stopPropagation()}>
                  <ActionMenu
                    size="sm"
                    trigger={<Icon name="ellipsis-vertical" size={16} />}
                    items={getActions(row)}
                  />
                </div>
              )}
            </div>

            {renderDetail && expanded && (
              <div className="mv-table-detail">{renderDetail(row)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
