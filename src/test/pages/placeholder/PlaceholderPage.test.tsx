import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlaceholderPage } from '../../../pages/placeholder/PlaceholderPage';

describe('PlaceholderPage', () => {
  it('renders with provided screen label', () => {
    render(<PlaceholderPage screen="dashboard" screenLabel="Dashboard" />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays placeholder icon', () => {
    render(<PlaceholderPage screen="dashboard" screenLabel="Dashboard" />);

    expect(screen.getByText('◬')).toBeInTheDocument();
  });

  it('displays placeholder message', () => {
    render(<PlaceholderPage screen="dashboard" screenLabel="Dashboard" />);

    expect(
      screen.getByText('Esta tela será implementada em breve.')
    ).toBeInTheDocument();
  });

  it('displays screen ID', () => {
    render(<PlaceholderPage screen="dashboard" screenLabel="Dashboard" />);

    expect(screen.getByText('Screen ID:')).toBeInTheDocument();
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('renders with different screen types', () => {
    const screenTypes = ['login', 'dashboard', 'requests', 'wizard'] as const;

    screenTypes.forEach(screenType => {
      const { unmount } = render(
        <PlaceholderPage screen={screenType} screenLabel={`${screenType} Page`} />
      );

      expect(screen.getByText(`${screenType} Page`)).toBeInTheDocument();
      expect(screen.getByText(screenType)).toBeInTheDocument();

      unmount();
    });
  });

  it('renders placeholder-page class', () => {
    const { container } = render(
      <PlaceholderPage screen="dashboard" screenLabel="Dashboard" />
    );

    expect(container.querySelector('.placeholder-page')).toBeInTheDocument();
  });

  it('renders placeholder-content class', () => {
    const { container } = render(
      <PlaceholderPage screen="dashboard" screenLabel="Dashboard" />
    );

    expect(container.querySelector('.placeholder-content')).toBeInTheDocument();
  });

  it('renders placeholder-icon class', () => {
    const { container } = render(
      <PlaceholderPage screen="dashboard" screenLabel="Dashboard" />
    );

    expect(container.querySelector('.placeholder-icon')).toBeInTheDocument();
  });

  it('renders h1 with type-h1-page class', () => {
    const { container } = render(
      <PlaceholderPage screen="dashboard" screenLabel="Dashboard" />
    );

    const heading = container.querySelector('h1.type-h1-page');
    expect(heading).toBeInTheDocument();
    expect(heading?.textContent).toBe('Dashboard');
  });

  it('renders placeholder-text class', () => {
    const { container } = render(
      <PlaceholderPage screen="dashboard" screenLabel="Dashboard" />
    );

    expect(container.querySelector('.placeholder-text')).toBeInTheDocument();
  });

  it('renders placeholder-id class', () => {
    const { container } = render(
      <PlaceholderPage screen="dashboard" screenLabel="Dashboard" />
    );

    expect(container.querySelector('.placeholder-id')).toBeInTheDocument();
  });

  it('renders screen ID in code tag', () => {
    const { container } = render(
      <PlaceholderPage screen="dashboard" screenLabel="Dashboard" />
    );

    const codeTag = container.querySelector('code');
    expect(codeTag).toBeInTheDocument();
    expect(codeTag?.textContent).toBe('dashboard');
  });

  it('handles long screen labels', () => {
    render(
      <PlaceholderPage
        screen="dashboard"
        screenLabel="Very Long Screen Label That Is Quite Descriptive"
      />
    );

    expect(
      screen.getByText('Very Long Screen Label That Is Quite Descriptive')
    ).toBeInTheDocument();
  });

  it('handles special characters in screen label', () => {
    render(
      <PlaceholderPage screen="dashboard" screenLabel="Dashboard & Settings" />
    );

    expect(screen.getByText('Dashboard & Settings')).toBeInTheDocument();
  });

  it('displays all props correctly together', () => {
    render(
      <PlaceholderPage screen="properties" screenLabel="Propriedades" />
    );

    expect(screen.getByText('Propriedades')).toBeInTheDocument();
    expect(screen.getByText('properties')).toBeInTheDocument();
    expect(
      screen.getByText('Esta tela será implementada em breve.')
    ).toBeInTheDocument();
  });

  it('maintains structure across different screens', () => {
    const testScreens = [
      { screenType: 'login' as const, label: 'Login' },
      { screenType: 'requests' as const, label: 'Requests' },
      { screenType: 'wizard' as const, label: 'Wizard' },
    ];

    testScreens.forEach(({ screenType, label }) => {
      const { container, unmount } = render(
        <PlaceholderPage screen={screenType} screenLabel={label} />
      );

      // Check for all required elements
      expect(container.querySelector('.placeholder-page')).toBeInTheDocument();
      expect(container.querySelector('.placeholder-content')).toBeInTheDocument();
      expect(container.querySelector('.placeholder-icon')).toBeInTheDocument();
      expect(container.querySelector('h1.type-h1-page')).toBeInTheDocument();
      expect(container.querySelector('.placeholder-text')).toBeInTheDocument();
      expect(container.querySelector('.placeholder-id')).toBeInTheDocument();
      expect(container.querySelector('code')).toBeInTheDocument();

      unmount();
    });
  });
});
