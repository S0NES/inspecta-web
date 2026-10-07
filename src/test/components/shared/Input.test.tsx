import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input, Select, Checkbox, Radio, Switch } from '../../../components/shared/Input';

describe('Input', () => {
  it('renders without label', () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('form-input');
  });

  it('renders with label', () => {
    render(<Input label="Email" data-testid="email-input" />);
    const input = screen.getByTestId('email-input');
    const label = screen.getByLabelText('Email');
    expect(label).toBeInTheDocument();
    expect(input).toBeInTheDocument();
  });

  it('generates id if not provided', () => {
    const { rerender } = render(<Input label="Test" />);
    const input = screen.getByDisplayValue('');
    const id = input.id;
    expect(id).toMatch(/^input-/);
    rerender(<Input label="Test" />);
  });

  it('uses provided id', () => {
    render(<Input id="custom-id" label="Name" />);
    const input = screen.getByDisplayValue('');
    expect(input.id).toBe('custom-id');
  });

  it('applies form-input class', () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveClass('form-input');
  });

  it('accepts input props', async () => {
    const user = userEvent.setup();
    render(<Input type="email" placeholder="your@email.com" data-testid="email" />);
    const input = screen.getByTestId('email');
    await user.type(input, 'test@example.com');
    expect(input).toHaveValue('test@example.com');
  });

  it('handles onChange callback', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Input onChange={handleChange} data-testid="input" />);
    const input = screen.getByTestId('input');
    await user.type(input, 'a');
    expect(handleChange).toHaveBeenCalled();
  });

  it('can be disabled', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Input disabled onChange={handleChange} data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toBeDisabled();
    await user.type(input, 'text');
    expect(handleChange).not.toHaveBeenCalled();
  });
});

describe('Select', () => {
  it('renders with label', () => {
    render(<Select label="Country" options={['USA', 'Canada']} />);
    const label = screen.getByLabelText('Country');
    expect(label).toBeInTheDocument();
  });

  it('renders without label', () => {
    render(<Select options={['Option 1']} />);
    const select = screen.getByDisplayValue('Selecionar');
    expect(select).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Select options={['Apple', 'Banana', 'Orange']} />);
    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Banana' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Orange' })).toBeInTheDocument();
  });

  it('has default "Selecionar" option', () => {
    render(<Select options={['Option 1']} />);
    const defaultOption = screen.getByRole('option', { name: 'Selecionar' });
    expect(defaultOption).toHaveValue('');
  });

  it('changes selected value on user selection', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Select
        options={['Option 1', 'Option 2']}
        onChange={handleChange}
        data-testid="select"
      />
    );
    const select = screen.getByTestId('select');
    await user.selectOptions(select, 'Option 1');
    expect(handleChange).toHaveBeenCalled();
  });

  it('applies form-select class', () => {
    render(<Select options={['Test']} data-testid="select" />);
    expect(screen.getByTestId('select')).toHaveClass('form-select');
  });

  it('can be disabled', async () => {
    const handleChange = vi.fn();
    render(
      <Select
        disabled
        options={['Option 1']}
        onChange={handleChange}
        data-testid="select"
      />
    );
    const select = screen.getByTestId('select');
    expect(select).toBeDisabled();
  });
});

describe('Checkbox', () => {
  it('renders without label', () => {
    render(<Checkbox data-testid="checkbox" />);
    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toHaveClass('form-checkbox');
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });

  it('renders with label', () => {
    render(<Checkbox label="Accept terms" />);
    const label = screen.getByLabelText('Accept terms');
    expect(label).toBeInTheDocument();
  });

  it('toggle checkbox state', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Check me" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('calls onChange handler', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox onChange={handleChange} data-testid="checkbox" />);
    await user.click(screen.getByTestId('checkbox'));
    expect(handleChange).toHaveBeenCalled();
  });

  it('can be disabled', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Checkbox disabled onChange={handleChange} data-testid="checkbox" />
    );
    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('can be pre-checked', () => {
    render(<Checkbox checked label="Checked" />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});

describe('Radio', () => {
  it('renders without label', () => {
    render(<Radio data-testid="radio" />);
    const radio = screen.getByTestId('radio');
    expect(radio).toHaveClass('form-radio');
    expect(radio).toHaveAttribute('type', 'radio');
  });

  it('renders with label', () => {
    render(<Radio label="Option A" />);
    const label = screen.getByLabelText('Option A');
    expect(label).toBeInTheDocument();
  });

  it('toggles radio state', async () => {
    const user = userEvent.setup();
    render(<Radio label="Select me" />);
    const radio = screen.getByRole('radio');
    expect(radio).not.toBeChecked();
    await user.click(radio);
    expect(radio).toBeChecked();
  });

  it('calls onChange handler', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Radio onChange={handleChange} data-testid="radio" />);
    await user.click(screen.getByTestId('radio'));
    expect(handleChange).toHaveBeenCalled();
  });

  it('can be disabled', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Radio disabled onChange={handleChange} data-testid="radio" />);
    const radio = screen.getByTestId('radio');
    expect(radio).toBeDisabled();
    await user.click(radio);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('supports multiple radios with same name', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <>
        <Radio name="choice" value="a" onChange={handleChange} />
        <Radio name="choice" value="b" onChange={handleChange} />
      </>
    );
    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);
    expect(radios[0]).toBeChecked();
    await user.click(radios[1]);
    expect(radios[1]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
  });
});

describe('Switch', () => {
  it('renders without label', () => {
    render(<Switch data-testid="switch" />);
    const input = screen.getByTestId('switch');
    expect(input).toHaveClass('form-switch');
    expect(input).toHaveAttribute('type', 'checkbox');
  });

  it('renders with label', () => {
    render(<Switch label="Enable feature" />);
    expect(screen.getByText('Enable feature')).toBeInTheDocument();
  });

  it('toggles switch state', async () => {
    const user = userEvent.setup();
    render(<Switch label="Toggle" />);
    const switchInput = screen.getByRole('checkbox');
    expect(switchInput).not.toBeChecked();
    await user.click(switchInput);
    expect(switchInput).toBeChecked();
  });

  it('calls onChange handler', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch onChange={handleChange} data-testid="switch" />);
    await user.click(screen.getByTestId('switch'));
    expect(handleChange).toHaveBeenCalled();
  });

  it('can be disabled', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Switch disabled onChange={handleChange} data-testid="switch" />
    );
    const switchInput = screen.getByTestId('switch');
    expect(switchInput).toBeDisabled();
    await user.click(switchInput);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('can be pre-checked', () => {
    render(<Switch checked label="Enabled" />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders label as separate element (not label wrapper)', () => {
    render(<Switch label="My Switch" />);
    const text = screen.getByText('My Switch');
    expect(text).toHaveClass('switch-text');
  });
});
