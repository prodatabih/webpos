import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: message };
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (typeof window !== 'undefined') {
      window.location.hash = '#/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-destructive/40 bg-card p-6 text-center shadow-sm space-y-4">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Došlo je do greške pri prikazu stranice
              </h2>
              <p className="text-xs text-muted-foreground break-words">
                {this.state.errorMessage || 'Neočekivana greška u komponenti.'}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={this.handleReset}>
              <RotateCcw className="h-4 w-4" />
              <span>Nazad na početnu</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
