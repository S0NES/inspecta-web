import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionMenu } from '../../../components/shared/ActionMenu';

const items = [{ key: 'excluir', label: 'Excluir cidade', onClick: vi.fn() }];

describe('ActionMenu', () => {
  it('abre o menu fora de um ancestral com overflow para não ser recortado', async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="clip" style={{ overflow: 'auto', maxHeight: 48 }}>
        <ActionMenu size="sm" items={items} />
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));

    const menu = screen.getByRole('menu');
    expect(screen.getByTestId('clip').contains(menu)).toBe(false);
    expect(menu).toHaveStyle({ position: 'fixed' });
  });

  it('move o foco para o primeiro item ao abrir e devolve ao gatilho no Escape', async () => {
    const user = userEvent.setup();
    render(<ActionMenu items={items} />);

    const trigger = screen.getByRole('button', { name: 'Mais ações' });
    await user.click(trigger);

    expect(screen.getByRole('menuitem', { name: 'Excluir cidade' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('fecha ao clicar fora mesmo com o menu no portal', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Fora</button>
        <ActionMenu items={items} />
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fora' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
