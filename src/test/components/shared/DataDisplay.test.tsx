import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, Badge, Tag, Tabs, Dialog, Toast, Tooltip } from '../../../components/shared/DataDisplay';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies card class', () => {
    render(
      <div data-testid="card-wrapper">
        <Card>Content</Card>
      </div>
    );
    const card = screen.getByTestId('card-wrapper').querySelector('.card');
    expect(card).toHaveClass('card');
  });

  it('applies elevated class when prop is true', () => {
    render(
      <div data-testid="card-wrapper">
        <Card elevated>Elevated</Card>
      </div>
    );
    const card = screen.getByTestId('card-wrapper').querySelector('.card');
    expect(card).toHaveClass('card--elevated');
  });

  it('does not apply elevated class when prop is false', () => {
    render(
      <div data-testid="card-wrapper">
        <Card elevated={false}>Not elevated</Card>
      </div>
    );
    const card = screen.getByTestId('card-wrapper').querySelector('.card');
    expect(card).not.toHaveClass('card--elevated');
  });

  it('applies custom className', () => {
    render(
      <div data-testid="card-wrapper">
        <Card className="custom">Content</Card>
      </div>
    );
    const card = screen.getByTestId('card-wrapper').querySelector('.card');
    expect(card).toHaveClass('custom');
  });

  it('renders nested React nodes', () => {
    render(
      <Card>
        <h2>Title</h2>
        <p>Content</p>
      </Card>
    );
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Badge text</Badge>);
    expect(screen.getByText('Badge text')).toBeInTheDocument();
  });

  it('applies default tone (gray)', () => {
    render(
      <div data-testid="badge-wrapper">
        <Badge>Default</Badge>
      </div>
    );
    const badge = screen.getByTestId('badge-wrapper').querySelector('.badge');
    expect(badge).toHaveClass('badge--gray');
  });

  it('applies ink tone', () => {
    render(
      <div data-testid="badge-wrapper">
        <Badge tone="ink">Ink</Badge>
      </div>
    );
    const badge = screen.getByTestId('badge-wrapper').querySelector('.badge');
    expect(badge).toHaveClass('badge--ink');
  });

  it('applies all tone options', () => {
    const tones: Array<'ink' | 'gray' | 'outline' | 'red'> = [
      'ink',
      'gray',
      'outline',
      'red',
    ];

    tones.forEach((tone) => {
      const { unmount } = render(
        <div data-testid="badge-wrapper">
          <Badge tone={tone}>Test</Badge>
        </div>
      );
      const badge = screen.getByTestId('badge-wrapper').querySelector('.badge');
      expect(badge).toHaveClass(`badge--${tone}`);
      unmount();
    });
  });

  it('applies custom className', () => {
    render(
      <div data-testid="badge-wrapper">
        <Badge className="custom-badge">Content</Badge>
      </div>
    );
    const badge = screen.getByTestId('badge-wrapper').querySelector('.badge');
    expect(badge).toHaveClass('custom-badge');
  });
});

describe('Tag', () => {
  it('renders children', () => {
    render(<Tag>Tag text</Tag>);
    expect(screen.getByText('Tag text')).toBeInTheDocument();
  });

  it('applies tag class', () => {
    render(
      <div data-testid="tag-wrapper">
        <Tag>Content</Tag>
      </div>
    );
    const tag = screen.getByTestId('tag-wrapper').querySelector('.tag');
    expect(tag).toHaveClass('tag');
  });

  it('does not render remove button by default', () => {
    render(<Tag>Static tag</Tag>);
    expect(screen.queryByRole('button', { name: /remover/i })).not.toBeInTheDocument();
  });

  it('renders remove button when removable is true', () => {
    render(<Tag removable>Removable tag</Tag>);
    expect(screen.getByRole('button', { name: /remover/i })).toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked', async () => {
    const handleRemove = vi.fn();
    const user = userEvent.setup();
    render(<Tag removable onRemove={handleRemove}>Removable</Tag>);
    await user.click(screen.getByRole('button', { name: /remover/i }));
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(
      <div data-testid="tag-wrapper">
        <Tag className="custom-tag">Content</Tag>
      </div>
    );
    const tag = screen.getByTestId('tag-wrapper').querySelector('.tag');
    expect(tag).toHaveClass('custom-tag');
  });

  it('remove button has aria-label', () => {
    render(<Tag removable>Tag</Tag>);
    const removeBtn = screen.getByRole('button');
    expect(removeBtn).toHaveAttribute('aria-label', 'Remover');
  });
});

describe('Tabs', () => {
  const defaultTabs = [
    { id: 'tab1', label: 'Tab 1' },
    { id: 'tab2', label: 'Tab 2' },
    { id: 'tab3', label: 'Tab 3' },
  ];

  it('renders all tabs', () => {
    render(
      <Tabs tabs={defaultTabs} activeTab="tab1" onTabChange={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Tab 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab 3' })).toBeInTheDocument();
  });

  it('marks active tab with tab--active class', () => {
    render(
      <div data-testid="tabs-wrapper">
        <Tabs tabs={defaultTabs} activeTab="tab2" onTabChange={() => {}} />
      </div>
    );
    const activeTab = screen.getByTestId('tabs-wrapper').querySelector(
      '.tab--active'
    );
    expect(activeTab).toHaveTextContent('Tab 2');
  });

  it('calls onTabChange when tab clicked', async () => {
    const handleTabChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tabs tabs={defaultTabs} activeTab="tab1" onTabChange={handleTabChange} />
    );
    await user.click(screen.getByRole('button', { name: 'Tab 2' }));
    expect(handleTabChange).toHaveBeenCalledWith('tab2');
  });

  it('passes correct tab id to onTabChange', async () => {
    const handleTabChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tabs tabs={defaultTabs} activeTab="tab1" onTabChange={handleTabChange} />
    );
    await user.click(screen.getByRole('button', { name: 'Tab 3' }));
    expect(handleTabChange).toHaveBeenCalledWith('tab3');
  });

  it('applies custom className', () => {
    render(
      <div data-testid="tabs-wrapper">
        <Tabs
          tabs={defaultTabs}
          activeTab="tab1"
          onTabChange={() => {}}
          className="custom-tabs"
        />
      </div>
    );
    const tabsContainer = screen.getByTestId('tabs-wrapper').querySelector('.tabs');
    expect(tabsContainer).toHaveClass('custom-tabs');
  });

  it('handles single tab', () => {
    const singleTab = [{ id: 'only', label: 'Only Tab' }];
    render(
      <Tabs tabs={singleTab} activeTab="only" onTabChange={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Only Tab' })).toBeInTheDocument();
  });

  it('handles empty tabs array', () => {
    render(<Tabs tabs={[]} activeTab="none" onTabChange={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('Dialog', () => {
  it('does not render when isOpen is false', () => {
    render(
      <Dialog isOpen={false} onClose={() => {}} title="Dialog">
        Content
      </Dialog>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <Dialog isOpen onClose={() => {}} title="Dialog">
        Content
      </Dialog>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Dialog isOpen onClose={() => {}} title="My Dialog">
        Content
      </Dialog>
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('My Dialog');
  });

  it('does not render title when not provided', () => {
    render(
      <Dialog isOpen onClose={() => {}}>
        Content
      </Dialog>
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <Dialog isOpen onClose={() => {}}>
        <p>Dialog body</p>
      </Dialog>
    );
    expect(screen.getByText('Dialog body')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <Dialog
        isOpen
        onClose={() => {}}
        actions={<button>Action Button</button>}
      >
        Content
      </Dialog>
    );
    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
  });

  it('has no info button when info prop is omitted', () => {
    render(
      <Dialog isOpen onClose={() => {}}>
        Content
      </Dialog>
    );
    expect(screen.queryByRole('button', { name: 'Sobre' })).not.toBeInTheDocument();
  });

  it('toggles the info panel from the header info button', async () => {
    const user = userEvent.setup();
    render(
      <Dialog isOpen onClose={() => {}} info={<span>Texto de ajuda do modal</span>}>
        Content
      </Dialog>
    );
    expect(screen.getByText('Texto de ajuda do modal')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sobre' }));
    expect(screen.getByText('Texto de ajuda do modal')).toBeVisible();
  });

  it('keeps title, info and close in a nowrap header', () => {
    render(
      <Dialog isOpen onClose={() => {}} title="Novo produto" info={<span>Ajuda</span>}>
        Content
      </Dialog>
    );
    const heading = screen.getByRole('heading', { name: 'Novo produto' });
    const header = heading.closest('.dialog-header') as HTMLElement;
    expect(header).toBeInTheDocument();
    expect(heading.closest('.dialog-header-start')).toContainElement(
      screen.getByRole('button', { name: 'Sobre' }),
    );
    expect(within(header).getByRole('button', { name: 'Fechar' }).closest('.dialog-header-end')).not.toBeNull();
  });

  it('calls onClose when close button clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog isOpen onClose={handleClose}>
        Content
      </Dialog>
    );
    const closeBtn = screen.getByRole('button', { name: 'Fechar' });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('is an accessible modal dialog and closes on Escape', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog isOpen onClose={handleClose} title="Acessível">
        Content
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Acessível');

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog isOpen onClose={handleClose}>
        Content
      </Dialog>
    );
    const overlay = document.querySelector('.dialog-overlay') as HTMLElement;
    await user.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when dialog content clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog isOpen onClose={handleClose}>
        <button>Inner Button</button>
      </Dialog>
    );
    await user.click(screen.getByRole('button', { name: 'Inner Button' }));
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('does not apply dialog--lg class by default', () => {
    render(
      <Dialog isOpen onClose={() => {}}>
        Content
      </Dialog>
    );
    expect(document.querySelector('.dialog')).not.toHaveClass('dialog--lg');
  });

  it('applies dialog--lg class when size is "lg"', () => {
    render(
      <Dialog isOpen onClose={() => {}} size="lg">
        Content
      </Dialog>
    );
    expect(document.querySelector('.dialog')).toHaveClass('dialog--lg');
  });
});

describe('Toast', () => {
  it('renders message', () => {
    render(<Toast message="Test message" onClose={() => {}} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('applies toast classes', () => {
    render(
      <div data-testid="toast-wrapper">
        <Toast message="Test" onClose={() => {}} />
      </div>
    );
    const toast = screen.getByTestId('toast-wrapper').querySelector('.toast');
    expect(toast).toHaveClass('toast', 'animate-mvfade');
  });

  it('auto-closes after 4200ms', async () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(<Toast message="Auto close" onClose={handleClose} />);
    expect(handleClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(4200);
    expect(handleClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('clears timeout on unmount', () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();
    const { unmount } = render(
      <Toast message="Will unmount" onClose={handleClose} />
    );

    unmount();
    vi.advanceTimersByTime(4200);
    expect(handleClose).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('only calls onClose once', async () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(<Toast message="Test" onClose={handleClose} />);
    vi.advanceTimersByTime(4200);
    vi.advanceTimersByTime(1000);

    expect(handleClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('renders dot element', () => {
    render(
      <div data-testid="toast-wrapper">
        <Toast message="Test" onClose={() => {}} />
      </div>
    );
    const dot = screen.getByTestId('toast-wrapper').querySelector('.toast-dot');
    expect(dot).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
  });

  it('renders tooltip content', () => {
    render(
      <Tooltip content="Help text">
        <span>Target</span>
      </Tooltip>
    );
    expect(screen.getByText('Help text')).toBeInTheDocument();
  });

  it('applies default position (top)', () => {
    render(
      <div data-testid="tooltip-wrapper">
        <Tooltip content="Content">
          <span>Target</span>
        </Tooltip>
      </div>
    );
    const tooltip = screen.getByTestId('tooltip-wrapper').querySelector('.tooltip');
    expect(tooltip).toHaveClass('tooltip--top');
  });

  it('applies custom position (bottom)', () => {
    render(
      <div data-testid="tooltip-wrapper">
        <Tooltip content="Content" position="bottom">
          <span>Target</span>
        </Tooltip>
      </div>
    );
    const tooltip = screen.getByTestId('tooltip-wrapper').querySelector('.tooltip');
    expect(tooltip).toHaveClass('tooltip--bottom');
  });

  it('applies all position options', () => {
    const positions: Array<'top' | 'bottom' | 'left' | 'right'> = [
      'top',
      'bottom',
      'left',
      'right',
    ];

    positions.forEach((position) => {
      const { unmount } = render(
        <div data-testid="tooltip-wrapper">
          <Tooltip content="Test" position={position}>
            <span>Text</span>
          </Tooltip>
        </div>
      );
      const tooltip = screen.getByTestId('tooltip-wrapper').querySelector('.tooltip');
      expect(tooltip).toHaveClass(`tooltip--${position}`);
      unmount();
    });
  });

  it('wraps content in tooltip-wrapper', () => {
    render(
      <div data-testid="outer">
        <Tooltip content="Content">
          <span>Child</span>
        </Tooltip>
      </div>
    );
    const wrapper = document.querySelector('.tooltip-wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.querySelector('span')).toHaveTextContent('Child');
  });
});
