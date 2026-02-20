import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from './Header';

describe('Header', () => {
  it('renders the app title', () => {
    render(<Header theme="light" onToggleTheme={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Color Palette Maker/
    );
  });

  it('shows Dark Mode button when theme is light', () => {
    render(<Header theme="light" onToggleTheme={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Dark Mode');
  });

  it('shows Light Mode button when theme is dark', () => {
    render(<Header theme="dark" onToggleTheme={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Light Mode');
  });

  it('calls onToggleTheme when button is clicked', () => {
    const onToggleTheme = vi.fn();
    render(<Header theme="light" onToggleTheme={onToggleTheme} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });
});
