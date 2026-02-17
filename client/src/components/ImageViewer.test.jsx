import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageViewer from './ImageViewer';

describe('ImageViewer', () => {
  let mockGetImageData;
  let mockGetContext;

  beforeEach(() => {
    mockGetImageData = vi.fn().mockReturnValue({
      data: [255, 0, 0, 255],
    });
    mockGetContext = vi.fn().mockReturnValue({
      getImageData: mockGetImageData,
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;

    global.Image = class MockImage {
      constructor() {
        this.src = '';
        this.crossOrigin = '';
        this.onload = null;
        this.onerror = null;
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders placeholder when no imageUrl', () => {
    render(
      <ImageViewer
        imageUrl=""
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onDoubleClickAddColor={vi.fn()}
      />
    );
    expect(screen.getByText(/select an image from the list/i)).toBeInTheDocument();
  });

  it('renders image when imageUrl is provided', () => {
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onDoubleClickAddColor={vi.fn()}
      />
    );
    const img = document.querySelector('#displayedImage');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/uploads/test.jpg');
  });

  it('calls onDoubleClickAddColor on double-click when in sampling mode', async () => {
    const onDoubleClickAddColor = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={true}
        onSampledColorChange={vi.fn()}
        onDoubleClickAddColor={onDoubleClickAddColor}
      />
    );
    const overlay = document.querySelector('.image-viewer-overlay');
    expect(overlay).toBeInTheDocument();
    fireEvent.doubleClick(overlay);
    expect(onDoubleClickAddColor).toHaveBeenCalledTimes(1);
  });

  it('does not call onDoubleClickAddColor when not in sampling mode', () => {
    const onDoubleClickAddColor = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onDoubleClickAddColor={onDoubleClickAddColor}
      />
    );
    const overlay = document.querySelector('.image-viewer-overlay');
    if (overlay) fireEvent.doubleClick(overlay);
    expect(onDoubleClickAddColor).not.toHaveBeenCalled();
  });

  it('calls onSampledColorChange(null) on mouse leave when in sampling mode', () => {
    const onSampledColorChange = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={true}
        onSampledColorChange={onSampledColorChange}
        onDoubleClickAddColor={vi.fn()}
      />
    );
    const overlay = document.querySelector('.image-viewer-overlay');
    fireEvent.mouseLeave(overlay);
    expect(onSampledColorChange).toHaveBeenCalledWith(null);
  });

  it('has crosshair cursor when in sampling mode', () => {
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={true}
        onSampledColorChange={vi.fn()}
        onDoubleClickAddColor={vi.fn()}
      />
    );
    const overlay = document.querySelector('.image-viewer-overlay');
    expect(overlay).toHaveStyle({ cursor: 'crosshair' });
  });

  it('uses img element with alt text', () => {
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onDoubleClickAddColor={vi.fn()}
      />
    );
    const img = document.querySelector('#displayedImage');
    expect(img).toHaveAttribute('alt', 'Palette image');
  });
});
