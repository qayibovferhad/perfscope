import React from 'react';
import { Panel } from '@/shared/ui/panel';
import { Button } from '@/shared/ui/button';

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render errors in the entire tree below
 * and renders a recovery UI rather than blanking the screen.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-ld-bg-2">
        <Panel className="max-w-md w-full flex flex-col gap-4 p-6">
          <div>
            <h1 className="text-lg font-semibold text-ld-text mb-1">Something went wrong</h1>
            <p className="text-sm text-ld-text-3">
              An unexpected error happened while rendering this page.
            </p>
          </div>

          <pre className="text-xs font-mono p-3 rounded-lg overflow-x-auto bg-ld-bg-2 text-ld-rose border border-[rgba(242,100,122,.3)]">
            {this.state.error.message}
          </pre>

          <div className="flex gap-2">
            <Button onClick={this.handleReset} variant="outline" className="flex-1">
              Try again
            </Button>
            <Button onClick={this.handleReload} className="flex-1">
              Reload page
            </Button>
          </div>
        </Panel>
      </div>
    );
  }
}
