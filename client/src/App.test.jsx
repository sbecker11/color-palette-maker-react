import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import api from './api';

vi.mock('./api');
vi.mock('./App.css', () => ({}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.getImages.mockResolvedValue({
      success: true,
      images: [
        {
          cachedFilePath: '/uploads/img-1.jpeg',
          paletteName: 'img-1',
          colorPalette: ['#ff0000', '#00ff00'],
        },
      ],
    });
    api.generatePalette.mockResolvedValue({ success: true, palette: ['#ff0000'] });
    api.upload.mockResolvedValue({ success: false });
    api.savePalette.mockResolvedValue({ success: true });
  });

  it('renders Header with theme toggle', async () => {
    render(<App />);
    await waitFor(() => {
      expect(api.getImages).toHaveBeenCalled();
    });
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders UploadForm', async () => {
    render(<App />);
    await waitFor(() => {
      expect(api.getImages).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: /source/i })).toBeInTheDocument();
  });

  it('loads images on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(api.getImages).toHaveBeenCalled();
    });
  });

  it('shows error message when getImages fails', async () => {
    api.getImages.mockResolvedValue({ success: false, message: 'Server error' });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/server error|could not load/i)).toBeInTheDocument();
    });
  });

  it('shows error when getImages throws', async () => {
    api.getImages.mockRejectedValue(new Error('Network error'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/error loading image list/i)).toBeInTheDocument();
    });
  });

  it('toggles theme when Header toggle is clicked', async () => {
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const toggle = screen.getByRole('button', { name: /theme|dark|light/i });
    fireEvent.click(toggle);
    expect(document.body.dataset.theme).toBe('dark');
  });

  it('calls upload and loadImages on successful upload', async () => {
    api.upload.mockResolvedValue({
      success: true,
      metadata: {
        cachedFilePath: '/uploads/new.jpeg',
        paletteName: 'new',
      },
    });
    api.generatePalette.mockResolvedValue({ success: true, palette: ['#000000'] });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const urlInput = screen.getByLabelText(/image url/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/img.jpg' } });
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => expect(api.upload).toHaveBeenCalled());
  });

  it('shows message on upload failure', async () => {
    api.upload.mockResolvedValue({ success: false, message: 'Upload failed' });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const urlInput = screen.getByLabelText(/image url/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/img.jpg' } });
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => {
      expect(screen.getByText(/upload failed|an error occurred/i)).toBeInTheDocument();
    });
  });

  it('calls handleRegenerateWithK when K-means (7) selected from dropdown', async () => {
    api.generatePalette.mockResolvedValue({
      success: true,
      palette: ['#111', '#222'],
    });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'kmeans7' } });
    await waitFor(() =>
      expect(api.generatePalette).toHaveBeenCalledWith(expect.any(String), { regenerate: true, k: 7 })
    );
  });

  it('calls handleExport when Export selected from dropdown', async () => {
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'export' } });
    expect(screen.getByText(/export initiated|please select/i)).toBeInTheDocument();
  });

  it('updates palette name on blur', async () => {
    api.saveMetadata.mockResolvedValue({ success: true });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const input = screen.getByLabelText(/name/i);
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.saveMetadata).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/palette name updated/i)).toBeInTheDocument()
    );
  });

  it('calls reorderImages when reorder triggered from ImageLibrary', async () => {
    api.getImages.mockResolvedValue({
      success: true,
      images: [
        { cachedFilePath: '/uploads/img-1.jpeg', paletteName: 'img-1', colorPalette: [] },
        { cachedFilePath: '/uploads/img-2.jpeg', paletteName: 'img-2', colorPalette: [] },
      ],
    });
    api.generatePalette.mockResolvedValue({ success: true, palette: [] });
    api.reorderImages.mockResolvedValue({ success: true });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const downBtns = screen.getAllByRole('button', { name: /move down/i });
    fireEvent.click(downBtns[0]);
    await waitFor(() => expect(api.reorderImages).toHaveBeenCalled());
  });

  it('auto-selects moved palette after reordering with top/bottom buttons', async () => {
    api.getImages.mockResolvedValue({
      success: true,
      images: [
        { cachedFilePath: '/uploads/img-1.jpeg', paletteName: 'img-1', colorPalette: ['#ff0000'] },
        { cachedFilePath: '/uploads/img-2.jpeg', paletteName: 'img-2', colorPalette: ['#00ff00'] },
        { cachedFilePath: '/uploads/img-3.jpeg', paletteName: 'img-3', colorPalette: ['#0000ff'] },
      ],
    });
    api.generatePalette.mockResolvedValue({ success: true, palette: [] });
    api.reorderImages.mockResolvedValue({ success: true });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    // Initially img-1 is selected (first image)
    expect(screen.getByLabelText(/name/i)).toHaveValue('img-1');
    // Click bottom button on second item (img-2) to move it to bottom
    const bottomBtns = screen.getAllByRole('button', { name: /move to bottom/i });
    const secondBottomBtn = bottomBtns[1]; // Second item's bottom button
    fireEvent.click(secondBottomBtn);
    await waitFor(() => expect(api.reorderImages).toHaveBeenCalled());
    // After reorder, img-2 should be selected (it moved to bottom, which is now index 2)
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('img-2');
    });
  });

  it('renders ImageViewer', async () => {
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    expect(document.getElementById('imageViewerContainer')).toBeInTheDocument();
  });

  it('calls handleDeleteSwatch when swatch delete is clicked', async () => {
    api.savePalette.mockResolvedValue({ success: true });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const deleteButtons = screen.getAllByTitle('Delete palette swatch');
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(api.savePalette).toHaveBeenCalled());
  });

  it('shows Select an image first when sampling mode clicked with no selection', async () => {
    api.getImages.mockResolvedValue({ success: true, images: [] });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const placeholderSwatch = screen.getByTitle(/click to enter add swatch mode/i);
    fireEvent.click(placeholderSwatch);
    expect(screen.getByText(/select an image first/i)).toBeInTheDocument();
  });

  it('calls handleToggleSamplingMode when placeholder swatch clicked with selection', async () => {
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const placeholderSwatch = screen.getByTitle(/click to enter add swatch mode/i);
    fireEvent.click(placeholderSwatch);
    expect(document.body.classList.contains('sampling-active')).toBe(true);
  });

  it('calls handleDeleteImage when Delete is clicked', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteImage.mockResolvedValue({ success: true });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const deleteBtn = screen.getByRole('button', { name: /del/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(api.deleteImage).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  it('triggers generatePalette when selecting image without palette', async () => {
    api.getImages.mockResolvedValue({
      success: true,
      images: [{ cachedFilePath: '/uploads/img-1.jpeg', paletteName: 'img-1' }],
    });
    api.generatePalette.mockResolvedValue({ success: true, palette: ['#aaa', '#bbb'] });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    await waitFor(() => expect(api.generatePalette).toHaveBeenCalledWith('img-1.jpeg'));
  });

  it('handles handleRegenerate failure', async () => {
    api.generatePalette.mockRejectedValue(new Error('Network error'));
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'kmeans7' } });
    await waitFor(() =>
      expect(screen.getByText(/failed to regenerate palette/i)).toBeInTheDocument()
    );
  });

  it('handles savePalette failure in handleDeleteSwatch', async () => {
    api.savePalette.mockResolvedValue({ success: false, message: 'Save failed' });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const deleteButtons = screen.getAllByTitle('Delete palette swatch');
    fireEvent.click(deleteButtons[0]);
    await waitFor(() =>
      expect(screen.getByText(/error saving palette|save failed/i)).toBeInTheDocument()
    );
  });

  it('handles handleExport with palette', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'export' } });
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('calls detectRegions and updates state when Detect Regions succeeds', async () => {
    api.detectRegions.mockResolvedValue({
      success: true,
      regions: [[[0, 0], [10, 0], [10, 10]]],
      paletteRegion: [{ x: 5, y: 5, hex: '#ff0000', regionColor: '#ff0000' }],
    });
    api.saveMetadata.mockResolvedValue({ success: true });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'detectRegions' } });
    await waitFor(() => expect(api.detectRegions).toHaveBeenCalledWith('img-1.jpeg'));
    await waitFor(() =>
      expect(screen.getByText(/detected \d+ region/i)).toBeInTheDocument()
    );
  });

  it('calls deleteRegions and saveMetadata when Clear all Regions succeeds', async () => {
    api.getImages.mockResolvedValue({
      success: true,
      images: [{
        cachedFilePath: '/uploads/img-1.jpeg',
        paletteName: 'img-1',
        colorPalette: ['#ff0000'],
        regions: [[[0, 0], [10, 0], [10, 10]]],
      }],
    });
    api.saveMetadata.mockResolvedValue({ success: true });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'deleteRegions' } });
    await waitFor(() => expect(api.saveMetadata).toHaveBeenCalledWith('img-1.jpeg', expect.objectContaining({ regions: [] })));
    await waitFor(() => expect(screen.getByText(/regions cleared/i)).toBeInTheDocument());
  });

  it('calls duplicateImage when Duplicate is selected', async () => {
    api.duplicateImage.mockResolvedValue({
      success: true,
      filename: 'img-dup.jpeg',
      metadata: { cachedFilePath: '/uploads/img-dup.jpeg', paletteName: 'img-1-copy-1' },
    });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'duplicate' } });
    await waitFor(() => expect(api.duplicateImage).toHaveBeenCalledWith('img-1.jpeg'));
  });

  it('calls refreshPairings when Match Region Swatches is turned on with regions and palette', async () => {
    api.getImages.mockResolvedValue({
      success: true,
      images: [{
        cachedFilePath: '/uploads/img-1.jpeg',
        paletteName: 'img-1',
        colorPalette: ['#ff0000', '#00ff00'],
        regions: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
      }],
    });
    api.refreshPairings = vi.fn().mockResolvedValue({
      success: true,
      paletteRegion: [{ x: 5, y: 5, hex: '#ff0000', regionColor: '#ff0000' }],
    });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const matchCheckbox = screen.getByRole('checkbox', { name: 'Match Region Swatches' });
    fireEvent.click(matchCheckbox);
    await waitFor(() => expect(api.refreshPairings).toHaveBeenCalledWith('img-1.jpeg'));
  });

  it('handleAddingSwatchesModeChange(false) exits adding swatches mode', async () => {
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const addCheckbox = screen.getByRole('checkbox', { name: 'Adding swatches (click)' });
    fireEvent.click(addCheckbox);
    expect(document.body.classList.contains('sampling-active')).toBe(true);
    fireEvent.click(addCheckbox);
    await waitFor(() => {
      expect(document.body.classList.contains('sampling-active')).toBe(false);
    });
  });

  it('calls handleClearAllSwatches when Clear all Swatches is selected', async () => {
    api.savePalette.mockResolvedValue({ success: true });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'clearSwatches' } });
    await waitFor(() => expect(api.savePalette).toHaveBeenCalledWith('img-1.jpeg', [], []));
    await waitFor(() => expect(screen.getByText(/all swatches cleared/i)).toBeInTheDocument());
  });

  it('calls enterDeleteRegionMode when Remove Region (click) is selected', async () => {
    api.getImages.mockResolvedValue({
      success: true,
      images: [{
        cachedFilePath: '/uploads/img-1.jpeg',
        paletteName: 'img-1',
        colorPalette: ['#ff0000'],
        regions: [[[0, 0], [10, 0], [10, 10]]],
      }],
    });
    render(<App />);
    await waitFor(() => expect(api.getImages).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'enterDeleteRegionMode' } });
    await waitFor(() =>
      expect(screen.getByText(/click a region to remove/i)).toBeInTheDocument()
    );
  });
});
