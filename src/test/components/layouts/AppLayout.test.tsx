import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLayout } from '../../../components/layouts/AppLayout';
import { useAppStore } from '../../../store/useAppStore';

// Mock child components
vi.mock('../../../components/layouts/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('../../../components/layouts/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

// Mock API client
vi.mock('../../../api/client', () => ({
  apiClient: {
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('AppLayout', () => {
  beforeEach(() => {
    useAppStore.setState({
      sidebarCollapsed: false,
      toastMessage: null,
    });
    vi.clearAllMocks();
  });

  it('renders layout structure', () => {
    render(
      <AppLayout>
        <div>Main content</div>
      </AppLayout>
    );
    expect(document.querySelector('.app-layout')).toBeInTheDocument();
  });

  it('renders Sidebar component', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders Header component', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders children in main element', () => {
    render(
      <AppLayout>
        <p>Main content here</p>
      </AppLayout>
    );
    expect(screen.getByText('Main content here')).toBeInTheDocument();
    const main = document.querySelector('.app-main');
    expect(main).toContainElement(screen.getByText('Main content here'));
  });

  it('applies app-main class to main element', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    const main = document.querySelector('.app-main');
    expect(main).toHaveClass('app-main');
  });

  it('applies app-main--collapsed class when sidebarCollapsed is true', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    const main = document.querySelector('.app-main');
    expect(main).toHaveClass('app-main--collapsed');
  });

  it('removes app-main--collapsed class when sidebarCollapsed is false', () => {
    useAppStore.setState({ sidebarCollapsed: false });
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    const main = document.querySelector('.app-main');
    expect(main).not.toHaveClass('app-main--collapsed');
  });

  it('does not render Toast when toastMessage is null', () => {
    useAppStore.setState({ toastMessage: null });
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    expect(document.querySelector('.toast')).not.toBeInTheDocument();
  });

  it('renders Toast when toastMessage is set', () => {
    useAppStore.setState({ toastMessage: 'Test message' });
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(document.querySelector('.toast')).toBeInTheDocument();
  });

  it('passes message to Toast component', () => {
    useAppStore.setState({ toastMessage: 'Success message' });
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('calls setToast(null) when Toast closes', async () => {
    vi.useFakeTimers();
    const setToastSpy = vi.spyOn(useAppStore.getState(), 'setToast');
    useAppStore.setState({ toastMessage: 'Test' });

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    vi.advanceTimersByTime(4200);
    expect(setToastSpy).toHaveBeenCalledWith(null);

    vi.useRealTimers();
  });

  it('updates Toast when toastMessage changes', () => {
    useAppStore.setState({ toastMessage: null });
    const { rerender } = render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    useAppStore.setState({ toastMessage: 'New message' });
    rerender(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByText('New message')).toBeInTheDocument();
  });

  it('renders multiple children nodes', () => {
    render(
      <AppLayout>
        <div>First child</div>
        <div>Second child</div>
        <div>Third child</div>
      </AppLayout>
    );
    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Second child')).toBeInTheDocument();
    expect(screen.getByText('Third child')).toBeInTheDocument();
  });

  it('renders complex nested content', () => {
    render(
      <AppLayout>
        <section>
          <h1>Title</h1>
          <article>
            <p>Nested content</p>
          </article>
        </section>
      </AppLayout>
    );
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByText('Nested content')).toBeInTheDocument();
  });

  it('responds to sidebar collapse state changes', () => {
    useAppStore.setState({ sidebarCollapsed: false });
    const { rerender } = render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    let main = document.querySelector('.app-main');
    expect(main).not.toHaveClass('app-main--collapsed');

    useAppStore.setState({ sidebarCollapsed: true });
    rerender(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    main = document.querySelector('.app-main');
    expect(main).toHaveClass('app-main--collapsed');
  });

  it('maintains Sidebar and Header position in layout', () => {
    render(
      <AppLayout>
        <div data-testid="main-content">Content</div>
      </AppLayout>
    );

    const layout = document.querySelector('.app-layout');
    const sidebar = screen.getByTestId('sidebar');
    const header = screen.getByTestId('header');
    const mainContent = screen.getByTestId('main-content');

    expect(layout?.contains(sidebar)).toBe(true);
    expect(layout?.contains(header)).toBe(true);
    expect(layout?.contains(mainContent)).toBe(true);
  });
});
