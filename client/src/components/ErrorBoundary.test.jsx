import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <span>Child content</span>
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/please refresh the page/i)).toBeInTheDocument();
  });

  it('calls componentDidCatch when child throws', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(console.error).toHaveBeenCalledWith('ErrorBoundary caught:', expect.any(Error), expect.any(Object));
  });

  it('shows error details in pre when DEV and error exists', () => {
    const origEnv = import.meta.env.DEV;
    import.meta.env.DEV = true;
    const ThrowError = () => {
      throw new Error('Test error message');
    };
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    const pre = document.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent('Test error message');
    import.meta.env.DEV = origEnv;
  });
});
