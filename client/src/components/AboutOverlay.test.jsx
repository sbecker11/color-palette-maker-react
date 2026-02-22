import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AboutOverlay from './AboutOverlay';

describe('AboutOverlay', () => {
  let onClose;

  beforeEach(() => {
    onClose = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the overlay with button role and aria-label', () => {
    render(<AboutOverlay onClose={onClose} />);
    const overlay = screen.getByRole('button', {
      name: /click to close and show app/i,
    });
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('aria-label', 'Click to close and show app');
  });

  it('renders the about iframe', () => {
    render(<AboutOverlay onClose={onClose} />);
    const iframe = screen.getByTitle('Color Palette Maker — About');
    expect(iframe).toBeInTheDocument();
    // Uses about:blank in test to avoid happy-dom iframe fetch/abort noise
    expect(iframe).toHaveAttribute('src', 'about:blank'); // /about.html in production
  });

  it('applies overlay layout and background styles', () => {
    render(<AboutOverlay onClose={onClose} />);
    const overlay = screen.getByRole('button');
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.background).toBe('#0A0A0A');
  });

  it('calls onClose when overlay is clicked', () => {
    render(<AboutOverlay onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Enter key is pressed', () => {
    render(<AboutOverlay onClose={onClose} />);
    const overlay = screen.getByRole('button');
    fireEvent.keyDown(overlay, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Space key is pressed', () => {
    render(<AboutOverlay onClose={onClose} />);
    const overlay = screen.getByRole('button');
    fireEvent.keyDown(overlay, { key: ' ' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other keys', () => {
    render(<AboutOverlay onClose={onClose} />);
    const overlay = screen.getByRole('button');
    fireEvent.keyDown(overlay, { key: 'Tab' });
    fireEvent.keyDown(overlay, { key: 'Escape' });
    fireEvent.keyDown(overlay, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('prevents default when Enter is pressed', () => {
    render(<AboutOverlay onClose={onClose} />);
    const overlay = screen.getByRole('button');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    fireEvent(overlay, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('prevents default when Space is pressed', () => {
    render(<AboutOverlay onClose={onClose} />);
    const overlay = screen.getByRole('button');
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    fireEvent(overlay, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('calls onClose when postMessage receives about-close', async () => {
    render(<AboutOverlay onClose={onClose} />);
    window.postMessage({ type: 'about-close' }, '*');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('does not call onClose for other message types', () => {
    render(<AboutOverlay onClose={onClose} />);
    window.postMessage({ type: 'other' }, '*');
    window.postMessage({}, '*');
    window.postMessage(null, '*');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes message listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<AboutOverlay onClose={onClose} />);
    expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('has tabIndex 0 for keyboard accessibility', () => {
    render(<AboutOverlay onClose={onClose} />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
  });
});
