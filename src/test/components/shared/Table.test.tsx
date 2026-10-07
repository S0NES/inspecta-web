import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, type TableColumn } from '../../../components/shared/Table';

interface Row {
  id: string;
  nome: string;
  cidade: string;
}

const rows: Row[] = [
  { id: '1', nome: 'Alameda das Rosas', cidade: 'Osasco' },
  { id: '2', nome: 'Rua das Flores', cidade: 'São Paulo' },
];

const columns: TableColumn<Row>[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'cidade', label: 'Cidade' },
];

describe('Table', () => {
  it('renders column headers in order', () => {
    render(<Table columns={columns} data={rows} rowKey={(r) => r.id} />);
    const headers = screen.getAllByText(/^(Nome|Cidade)$/);
    expect(headers.map((h) => h.textContent)).toEqual(['Nome', 'Cidade']);
  });

  it('renders row cells using default stringification', () => {
    render(<Table columns={columns} data={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText('Alameda das Rosas')).toBeInTheDocument();
    expect(screen.getByText('São Paulo')).toBeInTheDocument();
  });

  it('renders custom cell content via column.render', () => {
    const customColumns: TableColumn<Row>[] = [
      { key: 'nome', label: 'Nome', render: (r) => <strong>{r.nome.toUpperCase()}</strong> },
    ];
    render(<Table columns={customColumns} data={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText('ALAMEDA DAS ROSAS')).toBeInTheDocument();
  });

  it('shows the empty message when data is empty', () => {
    render(<Table columns={columns} data={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('shows a custom empty message when provided', () => {
    render(<Table columns={columns} data={[]} rowKey={(r) => r.id} emptyMessage="Sem imóveis" />);
    expect(screen.getByText('Sem imóveis')).toBeInTheDocument();
  });

  it('does not render a detail panel without renderDetail', () => {
    render(<Table columns={columns} data={rows} rowKey={(r) => r.id} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('expands the row detail panel on click and collapses on a second click', async () => {
    const user = userEvent.setup();
    render(
      <Table
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        renderDetail={(r) => <div>Detalhe de {r.nome}</div>}
      />
    );
    expect(screen.queryByText('Detalhe de Alameda das Rosas')).not.toBeInTheDocument();

    const [firstRow] = screen.getAllByRole('button');
    await user.click(firstRow);
    expect(screen.getByText('Detalhe de Alameda das Rosas')).toBeInTheDocument();

    await user.click(firstRow);
    expect(screen.queryByText('Detalhe de Alameda das Rosas')).not.toBeInTheDocument();
  });

  it('marks the expanded row with aria-expanded', async () => {
    const user = userEvent.setup();
    render(
      <Table
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        renderDetail={(r) => <div>{r.cidade}</div>}
      />
    );
    const [firstRow] = screen.getAllByRole('button');
    expect(firstRow).toHaveAttribute('aria-expanded', 'false');
    await user.click(firstRow);
    expect(firstRow).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onSelectRow and applies the selected class when selectable', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Table
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        selectable
        selectedRowKey={null}
        onSelectRow={handleSelect}
      />
    );
    const [firstRow] = screen.getAllByRole('button');
    await user.click(firstRow);
    expect(handleSelect).toHaveBeenCalledWith(rows[0]);
    expect(firstRow).not.toHaveClass('mv-table-row--selected');

    rerender(
      <Table
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        selectable
        selectedRowKey="1"
        onSelectRow={handleSelect}
      />
    );
    expect(screen.getAllByRole('button')[0]).toHaveClass('mv-table-row--selected');
  });

  it('renders per-row actions behind the ActionMenu trigger and invokes the callback', async () => {
    const handleEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <Table
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        getActions={(r) => [{ key: 'edit', label: 'Editar', onClick: () => handleEdit(r.id) }]}
      />
    );
    const triggers = screen.getAllByRole('button', { name: 'Mais ações' });
    expect(triggers).toHaveLength(rows.length);

    await user.click(triggers[0]);
    const menu = screen.getByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar' }));
    expect(handleEdit).toHaveBeenCalledWith('1');
  });

  it('does not toggle the row detail when clicking the action menu trigger', async () => {
    const user = userEvent.setup();
    render(
      <Table
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        renderDetail={(r) => <div>Detalhe de {r.nome}</div>}
        getActions={() => [{ key: 'edit', label: 'Editar', onClick: () => {} }]}
      />
    );
    const triggers = screen.getAllByRole('button', { name: 'Mais ações' });
    await user.click(triggers[0]);
    expect(screen.queryByText('Detalhe de Alameda das Rosas')).not.toBeInTheDocument();
  });
});
