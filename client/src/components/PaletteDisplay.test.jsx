import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PaletteDisplay from './PaletteDisplay';

describe('PaletteDisplay', () => {
  const defaultProps = {
    palette: ['#ff0000', '#00ff00'],
    isGenerating: false,
    isSamplingMode: false,
    currentSampledColor: null,
    onToggleSamplingMode: vi.fn(),
    onAddingSwatchesModeChange: vi.fn(),
    onDeleteSwatch: vi.fn(),
    onClearAllSwatches: vi.fn(),
    paletteName: 'Test Palette',
    onPaletteNameChange: vi.fn(),
    onExport: vi.fn(),
    onRegenerateWithK: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onPaletteNameBlur: vi.fn(),
    selectedMeta: { paletteName: 'Test Palette' },
    onDetectRegions: vi.fn(),
    onDeleteRegions: vi.fn(),
    onEnterDeleteRegionMode: vi.fn(),
    isDeleteRegionMode: false,
    onDeleteRegionModeChange: vi.fn(),
    regionsDetecting: false,
    hasRegions: false,
    onSwatchHover: vi.fn(),
  };

  it('renders Color Palette heading', () => {
    render(<PaletteDisplay {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Color Palette');
  });

  it('renders palette swatches', () => {
    render(<PaletteDisplay {...defaultProps} />);
    expect(screen.getByTitle('#ff0000')).toBeInTheDocument();
    expect(screen.getByTitle('#00ff00')).toBeInTheDocument();
  });

  it('shows actions dropdown with K-means options', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /find k-means swatches \(5\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /find k-means swatches \(7\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /find k-means swatches \(9\)/i })).toBeInTheDocument();
  });

  it('calls onRegenerateWithK when K-means (7) is selected', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'kmeans7' } });
    expect(defaultProps.onRegenerateWithK).toHaveBeenCalledWith(7);
  });

  it('shows Rename Palette, (Dup)licate Palette, (Del)ete Palette in actions dropdown', () => {
    render(<PaletteDisplay {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'Rename Palette' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '(Dup)licate Palette' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '(Del)ete Palette' })).toBeInTheDocument();
  });

  it('calls onDelete when (Del)ete is selected from dropdown', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'delete' } });
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onDuplicate when (Dup)licate is selected from dropdown', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'duplicate' } });
    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('calls onAddingSwatchesModeChange when Adding swatches (click) checkbox is changed', () => {
    const onAddingSwatchesModeChange = vi.fn();
    render(<PaletteDisplay {...defaultProps} onAddingSwatchesModeChange={onAddingSwatchesModeChange} />);
    const toggle = screen.getByRole('checkbox', { name: 'Adding swatches (click)' });
    fireEvent.click(toggle);
    expect(onAddingSwatchesModeChange).toHaveBeenCalledWith(true);
  });

  it('Adding swatches (click) toggle is checked when isSamplingMode', () => {
    render(<PaletteDisplay {...defaultProps} isSamplingMode={true} />);
    expect(screen.getByRole('checkbox', { name: 'Adding swatches (click)' })).toBeChecked();
  });

  it('Adding swatches (click) toggle is disabled when no selectedMeta', () => {
    render(<PaletteDisplay {...defaultProps} selectedMeta={null} />);
    expect(screen.getByRole('checkbox', { name: 'Adding swatches (click)' })).toBeDisabled();
  });

  it('calls onDeleteRegionModeChange when Deleting regions (click) checkbox is changed', () => {
    const onDeleteRegionModeChange = vi.fn();
    render(<PaletteDisplay {...defaultProps} hasRegions={true} onDeleteRegionModeChange={onDeleteRegionModeChange} />);
    const toggle = screen.getByRole('checkbox', { name: 'Deleting regions (click)' });
    fireEvent.click(toggle);
    expect(onDeleteRegionModeChange).toHaveBeenCalledWith(true);
  });

  it('Deleting regions (click) checkbox is checked when isDeleteRegionMode', () => {
    render(<PaletteDisplay {...defaultProps} hasRegions={true} isDeleteRegionMode={true} />);
    expect(screen.getByRole('checkbox', { name: 'Deleting regions (click)' })).toBeChecked();
  });

  it('Deleting regions (click) checkbox is disabled when no regions', () => {
    render(<PaletteDisplay {...defaultProps} hasRegions={false} />);
    expect(screen.getByRole('checkbox', { name: 'Deleting regions (click)' })).toBeDisabled();
  });

  it('shows Export Palette option in actions dropdown', () => {
    render(<PaletteDisplay {...defaultProps} />);
    expect(screen.getByRole('option', { name: /export palette/i })).toBeInTheDocument();
  });

  it('calls onExport when Export is selected from dropdown', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'export' } });
    expect(defaultProps.onExport).toHaveBeenCalledTimes(1);
  });

  it('shows palette name input', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const input = screen.getByLabelText(/name/i);
    expect(input).toHaveValue('Test Palette');
  });

  it('calls onPaletteNameBlur when palette name input loses focus', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const input = screen.getByLabelText(/name/i);
    fireEvent.blur(input);
    expect(defaultProps.onPaletteNameBlur).toHaveBeenCalledTimes(1);
  });

  it('shows Generating placeholder when isGenerating', () => {
    render(<PaletteDisplay {...defaultProps} isGenerating={true} />);
    expect(screen.getByText(/generating palette/i)).toBeInTheDocument();
  });

  it('calls onDeleteSwatch when swatch delete button is clicked', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const deleteButtons = screen.getAllByTitle('Delete palette swatch');
    fireEvent.click(deleteButtons[0]);
    expect(defaultProps.onDeleteSwatch).toHaveBeenCalledWith('#ff0000');
  });

  it('calls onToggleSamplingMode when placeholder swatch is clicked', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const placeholderSwatch = screen.getByTitle(/click to enter add swatch mode/i);
    fireEvent.click(placeholderSwatch);
    expect(defaultProps.onToggleSamplingMode).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleSamplingMode on Enter key on placeholder swatch', () => {
    const onToggle = vi.fn();
    render(<PaletteDisplay {...defaultProps} onToggleSamplingMode={onToggle} />);
    const placeholderSwatch = screen.getByTitle(/click to enter add swatch mode/i);
    fireEvent.keyDown(placeholderSwatch, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleSamplingMode on Space key on placeholder swatch', () => {
    const onToggle = vi.fn();
    render(<PaletteDisplay {...defaultProps} onToggleSamplingMode={onToggle} />);
    const placeholderSwatch = screen.getByTitle(/click to enter add swatch mode/i);
    fireEvent.keyDown(placeholderSwatch, { key: ' ' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onPaletteNameChange when input changes', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const input = screen.getByLabelText(/name/i);
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(defaultProps.onPaletteNameChange).toHaveBeenCalledWith('New Name');
  });

  it('shows no palette placeholder when no palette and not generating', () => {
    render(
      <PaletteDisplay
        {...defaultProps}
        palette={[]}
        isGenerating={false}
      />
    );
    expect(screen.getByText(/no color palette extracted/i)).toBeInTheDocument();
  });

  it('shows sampling hint when isSamplingMode and currentSampledColor', () => {
    render(
      <PaletteDisplay
        {...defaultProps}
        isSamplingMode={true}
        currentSampledColor="#abc123"
      />
    );
    expect(
      screen.getByTitle(/double-click palette image to add #abc123/i)
    ).toBeInTheDocument();
  });

  it('disables palette name input when no selectedMeta', () => {
    render(<PaletteDisplay {...defaultProps} selectedMeta={null} />);
    expect(screen.getByLabelText(/name/i)).toBeDisabled();
  });

  it('disables actions dropdown when no selectedMeta', () => {
    render(<PaletteDisplay {...defaultProps} selectedMeta={null} />);
    expect(screen.getByRole('combobox', { name: 'Choose action' })).toBeDisabled();
  });

  it('calls onDetectRegions when Detect all Regions is selected', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'detectRegions' } });
    expect(defaultProps.onDetectRegions).toHaveBeenCalledTimes(1);
  });

  it('calls onDeleteRegions when Clear all Regions is selected', () => {
    render(<PaletteDisplay {...defaultProps} hasRegions={true} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'deleteRegions' } });
    expect(defaultProps.onDeleteRegions).toHaveBeenCalledTimes(1);
  });

  it('calls onEnterDeleteRegionMode when Deleting Regions (click) is selected', () => {
    render(<PaletteDisplay {...defaultProps} hasRegions={true} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'enterDeleteRegionMode' } });
    expect(defaultProps.onEnterDeleteRegionMode).toHaveBeenCalledTimes(1);
  });

  it('calls onRegenerateWithK(5) when Find K-Means Swatches (5) is selected', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'kmeans5' } });
    expect(defaultProps.onRegenerateWithK).toHaveBeenCalledWith(5);
  });

  it('calls onRegenerateWithK(9) when Find K-Means Swatches (9) is selected', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'kmeans9' } });
    expect(defaultProps.onRegenerateWithK).toHaveBeenCalledWith(9);
  });

  it('adds highlighted class to swatch when hovered', () => {
    render(<PaletteDisplay {...defaultProps} hoveredSwatchIndex={0} />);
    const swatch = document.querySelector('.palette-swatch.highlighted');
    expect(swatch).toBeInTheDocument();
  });

  it('focuses and selects palette name input when Rename Palette is selected', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const input = screen.getByLabelText(/name/i);
    input.focus = vi.fn();
    input.select = vi.fn();
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'rename' } });
    expect(input.focus).toHaveBeenCalled();
    expect(input.select).toHaveBeenCalled();
  });

  it('calls onToggleSamplingMode when Adding Swatches (click) is selected (same as empty swatch)', () => {
    defaultProps.onToggleSamplingMode.mockClear();
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'enterAddingSwatches' } });
    expect(defaultProps.onToggleSamplingMode).toHaveBeenCalledTimes(1);
  });

  it('calls onClearAllSwatches when Clear all Swatches is selected', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'clearSwatches' } });
    expect(defaultProps.onClearAllSwatches).toHaveBeenCalledTimes(1);
  });

  it('calls onSwatchHover on mouse enter and leave', () => {
    const onSwatchHover = vi.fn();
    render(<PaletteDisplay {...defaultProps} onSwatchHover={onSwatchHover} />);
    const swatches = document.querySelectorAll('.palette-swatch');
    fireEvent.mouseEnter(swatches[0]);
    expect(onSwatchHover).toHaveBeenCalledWith(0);
    fireEvent.mouseLeave(swatches[0]);
    expect(onSwatchHover).toHaveBeenCalledWith(null);
  });
});
