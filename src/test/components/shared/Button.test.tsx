import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, IconButton } from '../../../components/shared/Button';
import { Icon } from '../../../components/shared/Icon';

describe('Button', () => {
  it('renders with default variant and size', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toHaveClass('btn', 'btn--primary', 'btn--md');
  });

  it('renders with custom variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn--secondary');
  });

  it('renders with custom size', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn--lg');
  });

  it('renders with all variant options', () => {
    const variants: Array<'primary' | 'secondary' | 'ghost' | 'accent'> = [
      'primary',
      'secondary',
      'ghost',
      'accent',
    ];

    variants.forEach((variant) => {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button')).toHaveClass(`btn--${variant}`);
      unmount();
    });
  });

  it('renders with all size options', () => {
    const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];

    sizes.forEach((size) => {
      const { unmount } = render(<Button size={size}>{size}</Button>);
      expect(screen.getByRole('button')).toHaveClass(`btn--${size}`);
      unmount();
    });
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is set', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('accepts custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('renders children as text', () => {
    render(<Button>Button Text</Button>);
    expect(screen.getByText('Button Text')).toBeInTheDocument();
  });

  it('renders children as React node', () => {
    render(
      <Button>
        <span data-testid="child">Icon</span>
      </Button>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('renders with default variant ghost and size md', () => {
    render(<IconButton><Icon name="search" /></IconButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn--icon', 'btn--ghost', 'btn--md');
  });

  it('renders with custom variant', () => {
    render(<IconButton variant="primary">★</IconButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn--icon', 'btn--primary');
  });

  it('renders with custom size', () => {
    render(<IconButton size="lg">◍</IconButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn--lg');
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<IconButton onClick={handleClick}>🎯</IconButton>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is set', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <IconButton disabled onClick={handleClick}>
        X
      </IconButton>
    );
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('distinguishes from Button via btn--icon class', () => {
    const { unmount: unmountIcon } = render(<IconButton>I</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('btn--icon');
    unmountIcon();

    const { unmount: unmountButton } = render(<Button>B</Button>);
    expect(screen.getByRole('button')).not.toHaveClass('btn--icon');
    unmountButton();
  });
});
