import React from 'react';
import { Button } from './Button';
import { getTranslations } from '../../i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time crashes in any single screen (e.g. a poisoned React Query
 * cache producing `undefined.map is not a function`) so one broken page shows a
 * recoverable message instead of a full white-screen crash of the whole app.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught render error', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const t = getTranslations().components.errorBoundary;
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            minHeight: '100vh',
          }}
        >
          <h1 className="type-h2">{t.title}</h1>
          <p>{t.body}</p>
          <Button variant="primary" onClick={this.handleReload}>
            {t.reload}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
