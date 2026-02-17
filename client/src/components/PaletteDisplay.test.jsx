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
    onDeleteSwatch: vi.fn(),
    paletteName: 'Test Palette',
    onPaletteNameChange: vi.fn(),
    onExport: vi.fn(),
    onRegenerateWithK: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onPaletteNameBlur: vi.fn(),
    selectedMeta: { paletteName: 'Test Palette' },
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
    expect(screen.getByRole('option', { name: /k-means \(5\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /k-means \(7\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /k-means \(9\)/i })).toBeInTheDocument();
  });

  it('calls onRegenerateWithK when K-means (7) is selected', () => {
    render(<PaletteDisplay {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: 'Choose action' });
    fireEvent.change(select, { target: { value: 'kmeans7' } });
    expect(defaultProps.onRegenerateWithK).toHaveBeenCalledWith(7);
  });

  it('shows (Del)ete and (Dup)licate at top of actions dropdown', () => {
    render(<PaletteDisplay {...defaultProps} />);
    expect(screen.getByRole('option', { name: '(Del)ete' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '(Dup)licate' })).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveTextContent('(Del)ete');
    expect(options[2]).toHaveTextContent('(Dup)licate');
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

  it('calls onToggleSamplingMode when Adding swatches toggle is changed', () => {
    const onToggle = vi.fn();
    render(<PaletteDisplay {...defaultProps} onToggleSamplingMode={onToggle} />);
    const toggle = screen.getByRole('checkbox', { name: 'Adding swatches' });
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('Adding swatches toggle is checked when isSamplingMode', () => {
    render(<PaletteDisplay {...defaultProps} isSamplingMode={true} />);
    expect(screen.getByRole('checkbox', { name: 'Adding swatches' })).toBeChecked();
  });

  it('Adding swatches toggle is disabled when no selectedMeta', () => {
    render(<PaletteDisplay {...defaultProps} selectedMeta={null} />);
    expect(screen.getByRole('checkbox', { name: 'Adding swatches' })).toBeDisabled();
  });

  it('shows Export option in actions dropdown', () => {
    render(<PaletteDisplay {...defaultProps} />);
    expect(screen.getByRole('option', { name: /export/i })).toBeInTheDocument();
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
});
