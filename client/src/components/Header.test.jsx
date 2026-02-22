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

  it('renders the header-tech span with React • Vite', () => {
    render(<Header theme="light" onToggleTheme={() => {}} />);
    expect(screen.getByText('React • Vite')).toBeInTheDocument();
  });

  it('renders Palette in em tag', () => {
    render(<Header theme="light" onToggleTheme={() => {}} />);
    const em = document.querySelector('em');
    expect(em).toHaveTextContent('Palette');
  });

  it('shows Dark Mode button when theme is light', () => {
    render(<Header theme="light" onToggleTheme={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Dark Mode');
  });

  it('shows Light Mode button when theme is dark', () => {
    render(<Header theme="dark" onToggleTheme={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Light Mode');
  });

  it('theme toggle button has id themeToggleButton', () => {
    render(<Header theme="light" onToggleTheme={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('id', 'themeToggleButton');
  });

  it('calls onToggleTheme when button is clicked', () => {
    const onToggleTheme = vi.fn();
    render(<Header theme="light" onToggleTheme={onToggleTheme} />);
    fireEvent.click(screen.getByRole('button', { name: /dark mode/i }));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('title has no button role when onTitleClick is not provided', () => {
    render(<Header theme="light" onToggleTheme={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1); // only theme toggle
    const titleSpan = document.querySelector('.hero-title');
    expect(titleSpan).not.toHaveAttribute('role', 'button');
  });

  it('title has button role and hero-title-clickable when onTitleClick is provided', () => {
    render(<Header theme="light" onToggleTheme={() => {}} onTitleClick={() => {}} />);
    const titleButton = screen.getByRole('button', { name: /Color Palette Maker/i });
    expect(titleButton).toHaveClass('hero-title-clickable');
  });

  it('calls onTitleClick when title is clicked', () => {
    const onTitleClick = vi.fn();
    render(<Header theme="light" onToggleTheme={() => {}} onTitleClick={onTitleClick} />);
    const titleButton = screen.getByRole('button', { name: /Color Palette Maker/i });
    fireEvent.click(titleButton);
    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onTitleClick when Enter key is pressed on title', () => {
    const onTitleClick = vi.fn();
    render(<Header theme="light" onToggleTheme={() => {}} onTitleClick={onTitleClick} />);
    const titleButton = screen.getByRole('button', { name: /Color Palette Maker/i });
    fireEvent.keyDown(titleButton, { key: 'Enter' });
    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onTitleClick when Space key is pressed on title', () => {
    const onTitleClick = vi.fn();
    render(<Header theme="light" onToggleTheme={() => {}} onTitleClick={onTitleClick} />);
    const titleButton = screen.getByRole('button', { name: /Color Palette Maker/i });
    fireEvent.keyDown(titleButton, { key: ' ' });
    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onTitleClick for other keys', () => {
    const onTitleClick = vi.fn();
    render(<Header theme="light" onToggleTheme={() => {}} onTitleClick={onTitleClick} />);
    const titleButton = screen.getByRole('button', { name: /Color Palette Maker/i });
    fireEvent.keyDown(titleButton, { key: 'Tab' });
    fireEvent.keyDown(titleButton, { key: 'a' });
    expect(onTitleClick).not.toHaveBeenCalled();
  });

  it('prevents default when Enter is pressed on title', () => {
    const onTitleClick = vi.fn();
    render(<Header theme="light" onToggleTheme={() => {}} onTitleClick={onTitleClick} />);
    const titleButton = screen.getByRole('button', { name: /Color Palette Maker/i });
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    fireEvent(titleButton, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('renders About link when onAboutClick is provided', () => {
    render(<Header theme="light" onToggleTheme={() => {}} onAboutClick={() => {}} />);
    const aboutLink = screen.getByRole('link', { name: /about/i });
    expect(aboutLink).toBeInTheDocument();
    expect(aboutLink).toHaveAttribute('href', '/about.html');
  });

  it('calls onAboutClick when About link is clicked', () => {
    const onAboutClick = vi.fn();
    render(<Header theme="light" onToggleTheme={() => {}} onAboutClick={onAboutClick} />);
    fireEvent.click(screen.getByRole('link', { name: /about/i }));
    expect(onAboutClick).toHaveBeenCalledTimes(1);
  });

  it('prevents default when Space is pressed on title', () => {
    const onTitleClick = vi.fn();
    render(<Header theme="light" onToggleTheme={() => {}} onTitleClick={onTitleClick} />);
    const titleButton = screen.getByRole('button', { name: /Color Palette Maker/i });
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    fireEvent(titleButton, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
