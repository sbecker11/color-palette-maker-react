import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
        this.naturalWidth = 100;
        this.naturalHeight = 80;
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
        onAddColorClick={vi.fn()}
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
        onAddColorClick={vi.fn()}
      />
    );
    const img = document.querySelector('#displayedImage');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/uploads/test.jpg');
  });

  it('calls onAddColorClick with sampled hex on click when in sampling mode', async () => {
    const onAddColorClick = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={true}
        onSampledColorChange={vi.fn()}
        onAddColorClick={onAddColorClick}
      />
    );
    await waitFor(() => {
      const canvas = document.querySelector('#imageCanvas');
      expect(canvas).toBeInTheDocument();
      expect(canvas.width).toBe(100);
    });
    const img = document.querySelector('#displayedImage');
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 80, configurable: true });
    Object.defineProperty(img, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(img, 'clientHeight', { value: 80, configurable: true });
    img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 80 });

    const overlay = document.querySelector('.image-viewer-overlay');
    fireEvent.click(overlay, { clientX: 50, clientY: 40 });
    expect(onAddColorClick).toHaveBeenCalledWith('#ff0000');
  });

  it('does not call onAddColorClick on click when not in sampling mode', () => {
    const onAddColorClick = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={onAddColorClick}
      />
    );
    const overlay = document.querySelector('.image-viewer-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(onAddColorClick).not.toHaveBeenCalled();
  });

  it('calls onSampledColorChange with hex on mouse move when in sampling mode', async () => {
    const onSampledColorChange = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={true}
        onSampledColorChange={onSampledColorChange}
        onAddColorClick={vi.fn()}
      />
    );
    await waitFor(() => {
      const canvas = document.querySelector('#imageCanvas');
      expect(canvas).toBeInTheDocument();
    });
    const img = document.querySelector('#displayedImage');
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 80, configurable: true });
    Object.defineProperty(img, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(img, 'clientHeight', { value: 80, configurable: true });
    img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 80 });
    const overlay = document.querySelector('.image-viewer-overlay');
    fireEvent.mouseMove(overlay, { clientX: 50, clientY: 40 });
    expect(onSampledColorChange).toHaveBeenCalledWith('#ff0000');
  });

  it('calls onSampledColorChange(null) on mouse leave when in sampling mode', () => {
    const onSampledColorChange = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={true}
        onSampledColorChange={onSampledColorChange}
        onAddColorClick={vi.fn()}
      />
    );
    const overlay = document.querySelector('.image-viewer-overlay');
    fireEvent.mouseLeave(overlay);
    expect(onSampledColorChange).toHaveBeenCalledWith(null);
  });

  it('has crosshair (plus) cursor when in sampling mode', () => {
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={true}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
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
        onAddColorClick={vi.fn()}
      />
    );
    const img = document.querySelector('#displayedImage');
    expect(img).toHaveAttribute('alt', 'Palette image');
  });

  it('renders region overlay SVG when regions and imageSize are set', async () => {
    const regions = [[[0, 0], [10, 0], [10, 10], [0, 10]]];
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
        regions={regions}
      />
    );
    await waitFor(() => {
      const svg = document.querySelector('.region-overlay');
      expect(svg).toBeInTheDocument();
    });
    const path = document.querySelector('.region-boundary[data-region-index="0"]');
    expect(path).toBeInTheDocument();
  });

  it('calls onRegionClick when region path is clicked in delete mode (mode stays until click outside)', async () => {
    const onRegionClick = vi.fn();
    const onExitDeleteRegionMode = vi.fn();
    const regions = [[[0, 0], [10, 0], [10, 10], [0, 10]]];
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
        regions={regions}
        isDeleteRegionMode={true}
        onRegionClick={onRegionClick}
        onExitDeleteRegionMode={onExitDeleteRegionMode}
      />
    );
    await waitFor(() => {
      expect(document.querySelector('.region-boundary')).toBeInTheDocument();
    });
    const path = document.querySelector('.region-boundary[data-region-index="0"]');
    fireEvent.click(path);
    expect(onRegionClick).toHaveBeenCalledWith(0);
    expect(onExitDeleteRegionMode).not.toHaveBeenCalled();
  });

  it('calls onExitDeleteRegionMode when clicking outside viewer in delete mode', async () => {
    const onExitDeleteRegionMode = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
        isDeleteRegionMode={true}
        onExitDeleteRegionMode={onExitDeleteRegionMode}
      />
    );
    await waitFor(() => {
      expect(document.querySelector('#imageViewer')).toBeInTheDocument();
    });
    fireEvent.mouseDown(document.body);
    expect(onExitDeleteRegionMode).toHaveBeenCalled();
  });

  it('calls onExitAddingSwatchesMode when clicking outside viewer in sampling mode', async () => {
    const onExitAddingSwatchesMode = vi.fn();
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={true}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
        onExitAddingSwatchesMode={onExitAddingSwatchesMode}
      />
    );
    await waitFor(() => {
      expect(document.querySelector('#imageViewer')).toBeInTheDocument();
    });
    fireEvent.mouseDown(document.body);
    expect(onExitAddingSwatchesMode).toHaveBeenCalled();
  });

  it('does not call onExitDeleteRegionMode when clicking SVG without region target (exit only outside image)', async () => {
    const onExitDeleteRegionMode = vi.fn();
    const regions = [[[0, 0], [10, 0], [10, 10], [0, 10]]];
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
        regions={regions}
        isDeleteRegionMode={true}
        onExitDeleteRegionMode={onExitDeleteRegionMode}
      />
    );
    await waitFor(() => {
      expect(document.querySelector('.region-overlay')).toBeInTheDocument();
    });
    const svg = document.querySelector('.region-overlay');
    fireEvent.click(svg);
    expect(onExitDeleteRegionMode).not.toHaveBeenCalled();
  });

  it('renders palette region display when paletteRegion and imageSize are set', async () => {
    const paletteRegion = [{ x: 50, y: 40, hex: '#ff0000', regionColor: '#ff0000' }];
    const palette = ['#ff0000', '#00ff00'];
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
        paletteRegion={paletteRegion}
        palette={palette}
        regionLabels={['00']}
      />
    );
    await waitFor(() => {
      const g = document.querySelector('.region-display');
      expect(g).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Region 00')).toBeInTheDocument();
  });

  it('has crosshair cursor when in delete region mode', async () => {
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
        isDeleteRegionMode={true}
      />
    );
    await waitFor(() => {
      const overlay = document.querySelector('.image-viewer-overlay');
      expect(overlay).toHaveStyle({ cursor: 'crosshair' });
    });
  });

  it('calls onSwatchHover when hovering region in Match Region Swatches mode', async () => {
    const onSwatchHover = vi.fn();
    const regions = [[[0, 0], [10, 0], [10, 10], [0, 10]]];
    const paletteRegion = [{ x: 5, y: 5, hex: '#ff0000', regionColor: '#ff0000' }];
    const palette = ['#ff0000', '#00ff00'];
    render(
      <ImageViewer
        imageUrl="/uploads/test.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
        regions={regions}
        paletteRegion={paletteRegion}
        palette={palette}
        showMatchPaletteSwatches={true}
        onSwatchHover={onSwatchHover}
      />
    );
    await waitFor(() => {
      expect(document.querySelector('.region-display')).toBeInTheDocument();
    });
    const regionDisplay = document.querySelector('.region-display');
    fireEvent.mouseEnter(regionDisplay);
    expect(onSwatchHover).toHaveBeenCalledWith(0);
  });

  it('handles image load error via onerror', async () => {
    const OriginalImage = global.Image;
    global.Image = class MockImageError {
      constructor() {
        this.src = '';
        this.crossOrigin = '';
        this.onload = null;
        this.onerror = null;
        setTimeout(() => {
          if (this.onerror) this.onerror();
        }, 0);
      }
    };
    render(
      <ImageViewer
        imageUrl="/uploads/bad.jpg"
        isSamplingMode={false}
        onSampledColorChange={vi.fn()}
        onAddColorClick={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(document.querySelector('#displayedImage')).toBeInTheDocument();
    });
    global.Image = OriginalImage;
  });
});
