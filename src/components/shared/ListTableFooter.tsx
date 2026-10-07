import React from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { useTranslation, fmt } from '../../i18n';
import './ListTable.css';

interface ListTableFooterProps {
  shown: number;
  total: number;
  page: number;
  totalPages: number;
  /** Já interpolado, ex.: "3 de 40 usuários". */
  countLabel: string;
  isFetching?: boolean;
  onPage: (page: number) => void;
}

/** Rodapé da listagem paginada — o mesmo da tabela de solicitações. */
export const ListTableFooter: React.FC<ListTableFooterProps> = ({
  page,
  totalPages,
  countLabel,
  isFetching = false,
  onPage,
}) => {
  const { t } = useTranslation();
  const last = totalPages <= 1 || page >= totalPages - 1;
  return (
    <div className="list-table-footer">
      <span className="list-table-footer-text">
        {countLabel}
        {totalPages > 1 && fmt(t.common.listFooterPage, { page: page + 1, total: totalPages })}
      </span>
      <div className="list-table-footer-actions">
        <Button
          size="sm"
          variant="ghost"
          disabled={page === 0 || isFetching}
          onClick={() => onPage(Math.max(0, page - 1))}
        >
          <Icon name="chevron-left" size={14} /> {t.common.pagination.prev}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={last || isFetching}
          onClick={() => onPage(page + 1)}
        >
          {t.common.pagination.next} <Icon name="chevron-right" size={14} />
        </Button>
      </div>
    </div>
  );
};

export type { ListTableFooterProps };
