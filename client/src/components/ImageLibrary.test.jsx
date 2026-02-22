import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageLibrary from './ImageLibrary';

describe('ImageLibrary', () => {
  const mockMeta = {
    cachedFilePath: '/uploads/img-123.jpeg',
    paletteName: 'Test',
    width: 100,
    height: 100,
  };

  it('renders Color Palettes heading', () => {
    render(
      <ImageLibrary images={[mockMeta]} isLoading={false} onSelectImage={vi.fn()} />
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Color Palettes');
  });

  it('shows Loading when isLoading', () => {
    render(
      <ImageLibrary images={[]} isLoading={true} onSelectImage={vi.fn()} />
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows No images stored when empty', () => {
    render(
      <ImageLibrary images={[]} isLoading={false} onSelectImage={vi.fn()} />
    );
    expect(screen.getByText(/no images stored/i)).toBeInTheDocument();
  });

  it('renders library items with up/down buttons', () => {
    render(
      <ImageLibrary
        images={[mockMeta]}
        isLoading={false}
        onSelectImage={vi.fn()}
        onReorder={vi.fn()}
      />
    );
    const upButtons = screen.getAllByLabelText(/move up/i);
    const downButtons = screen.getAllByLabelText(/move down/i);
    expect(upButtons.length).toBeGreaterThan(0);
    expect(downButtons.length).toBeGreaterThan(0);
  });

  it('uses filename when paletteName equals filenameWithoutExt', () => {
    const meta = {
      cachedFilePath: '/uploads/img-123.jpeg',
      paletteName: 'img-123',
    };
    render(
      <ImageLibrary images={[meta]} isLoading={false} onSelectImage={vi.fn()} />
    );
    expect(screen.getByRole('link', { name: /img-123\.jpeg/ })).toBeInTheDocument();
  });

  it('calls onReorder with index and "up" when up button clicked', () => {
    const onReorder = vi.fn();
    const images = [mockMeta, { ...mockMeta, cachedFilePath: '/uploads/img-456.jpeg' }];
    render(
      <ImageLibrary
        images={images}
        isLoading={false}
        onReorder={onReorder}
        onSelectImage={vi.fn()}
      />
    );
    const upButtons = screen.getAllByLabelText(/move up/i);
    // First item: up disabled. Second item: up enabled
    const secondUp = upButtons.find((btn) => !btn.disabled);
    if (secondUp) {
      fireEvent.click(secondUp);
      expect(onReorder).toHaveBeenCalledWith(1, 'up');
    }
  });

  it('calls onReorder with index and "down" when down button clicked', () => {
    const onReorder = vi.fn();
    const images = [mockMeta, { ...mockMeta, cachedFilePath: '/uploads/img-456.jpeg' }];
    render(
      <ImageLibrary
        images={images}
        isLoading={false}
        onReorder={onReorder}
        onSelectImage={vi.fn()}
      />
    );
    const downButtons = screen.getAllByLabelText(/move down/i);
    const firstDown = downButtons.find((btn) => !btn.disabled);
    if (firstDown) {
      fireEvent.click(firstDown);
      expect(onReorder).toHaveBeenCalledWith(0, 'down');
    }
  });

  it('calls onReorder with index and "top" when move to top button clicked', () => {
    const onReorder = vi.fn();
    const images = [
      { ...mockMeta, cachedFilePath: '/uploads/img-a.jpeg' },
      { ...mockMeta, cachedFilePath: '/uploads/img-b.jpeg' },
      { ...mockMeta, cachedFilePath: '/uploads/img-c.jpeg' },
    ];
    render(
      <ImageLibrary
        images={images}
        isLoading={false}
        onReorder={onReorder}
        onSelectImage={vi.fn()}
      />
    );
    const topButtons = screen.getAllByLabelText(/move to top/i);
    const secondTop = topButtons.find((btn) => !btn.disabled);
    expect(secondTop).toBeTruthy();
    fireEvent.click(secondTop);
    expect(onReorder).toHaveBeenCalledWith(1, 'top');
  });

  it('calls onReorder with index and "bottom" when move to bottom button clicked', () => {
    const onReorder = vi.fn();
    const images = [
      { ...mockMeta, cachedFilePath: '/uploads/img-a.jpeg' },
      { ...mockMeta, cachedFilePath: '/uploads/img-b.jpeg' },
    ];
    render(
      <ImageLibrary
        images={images}
        isLoading={false}
        onReorder={onReorder}
        onSelectImage={vi.fn()}
      />
    );
    const bottomButtons = screen.getAllByLabelText(/move to bottom/i);
    const firstBottom = bottomButtons.find((btn) => !btn.disabled);
    expect(firstBottom).toBeTruthy();
    fireEvent.click(firstBottom);
    expect(onReorder).toHaveBeenCalledWith(0, 'bottom');
  });

  it('calls onSelectImage when list item link is clicked', () => {
    const onSelectImage = vi.fn();
    render(
      <ImageLibrary
        images={[mockMeta]}
        isLoading={false}
        onSelectImage={onSelectImage}
      />
    );
    const link = screen.getByRole('link', { name: /Test/i });
    fireEvent.click(link, { preventDefault: () => {} });
    expect(onSelectImage).toHaveBeenCalledWith(mockMeta, '/uploads/img-123.jpeg');
  });

  it('calls onDuplicateImage when Dup button clicked', () => {
    const onDuplicateImage = vi.fn();
    render(
      <ImageLibrary
        images={[mockMeta]}
        isLoading={false}
        onSelectImage={vi.fn()}
        onDuplicateImage={onDuplicateImage}
      />
    );
    const dupBtn = screen.getByRole('button', { name: /dup/i });
    fireEvent.click(dupBtn);
    expect(onDuplicateImage).toHaveBeenCalledWith('img-123.jpeg', mockMeta);
  });

  it('calls onDeleteImage when Del button clicked', () => {
    const onDeleteImage = vi.fn();
    render(
      <ImageLibrary
        images={[mockMeta]}
        isLoading={false}
        onSelectImage={vi.fn()}
        onDeleteImage={onDeleteImage}
      />
    );
    const delBtn = screen.getByRole('button', { name: /del/i });
    fireEvent.click(delBtn);
    expect(onDeleteImage).toHaveBeenCalledWith('img-123.jpeg', mockMeta);
  });

  it('applies selected-image class when item is selected', () => {
    render(
      <ImageLibrary
        images={[mockMeta]}
        selectedMeta={mockMeta}
        isLoading={false}
        onSelectImage={vi.fn()}
      />
    );
    const listItem = document.querySelector('.selected-image');
    expect(listItem).toBeInTheDocument();
  });

  it('shows paletteName as display name when different from filename', () => {
    const metaWithName = { ...mockMeta, paletteName: 'My Custom Name' };
    render(
      <ImageLibrary
        images={[metaWithName]}
        isLoading={false}
        onSelectImage={vi.fn()}
      />
    );
    const link = screen.getByRole('link', { name: /My Custom Name/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/uploads/img-123.jpeg');
  });

  it('uses filename when paletteName equals filenameWithoutExt', () => {
    const metaSameAsFilename = { ...mockMeta, paletteName: 'img-123' };
    render(
      <ImageLibrary
        images={[metaSameAsFilename]}
        isLoading={false}
        onSelectImage={vi.fn()}
      />
    );
    expect(screen.getByRole('link', { name: /img-123\.jpeg/ })).toBeInTheDocument();
  });

  it('renders with minimal meta (no width, height, format, fileSizeBytes, createdDateTime)', () => {
    const minimalMeta = { cachedFilePath: '/uploads/minimal.jpeg' };
    render(
      <ImageLibrary
        images={[minimalMeta]}
        isLoading={false}
        onSelectImage={vi.fn()}
      />
    );
    expect(screen.getByRole('link', { name: /minimal\.jpeg/ })).toBeInTheDocument();
  });

  it('uses "unknown" as filename when cachedFilePath is missing', () => {
    const metaNoPath = { paletteName: 'No Path' };
    render(
      <ImageLibrary
        images={[metaNoPath]}
        isLoading={false}
        onSelectImage={vi.fn()}
      />
    );
    const link = document.querySelector('a[href="/uploads/unknown"]');
    expect(link).toBeInTheDocument();
  });

  it('shows No images stored when images is null', () => {
    render(
      <ImageLibrary images={null} isLoading={false} onSelectImage={vi.fn()} />
    );
    expect(screen.getByText(/no images stored/i)).toBeInTheDocument();
  });

  it('does not apply selected-image when selectedMeta references different image', () => {
    const metaA = { ...mockMeta, cachedFilePath: '/uploads/img-a.jpeg' };
    const metaB = { ...mockMeta, cachedFilePath: '/uploads/img-b.jpeg' };
    render(
      <ImageLibrary
        images={[metaA, metaB]}
        selectedMeta={metaA}
        isLoading={false}
        onSelectImage={vi.fn()}
      />
    );
    const items = document.querySelectorAll('#fileList li');
    expect(items[0]).toHaveClass('selected-image');
    expect(items[1]).not.toHaveClass('selected-image');
  });

  it('does not throw when onReorder is undefined and reorder buttons are clicked', () => {
    const images = [
      { ...mockMeta, cachedFilePath: '/uploads/img-a.jpeg' },
      { ...mockMeta, cachedFilePath: '/uploads/img-b.jpeg' },
    ];
    render(
      <ImageLibrary images={images} isLoading={false} onSelectImage={vi.fn()} />
    );
    const topButtons = screen.getAllByLabelText(/move to top/i);
    const topBtn = topButtons.find((b) => !b.disabled);
    expect(topBtn).toBeTruthy();
    expect(() => fireEvent.click(topBtn)).not.toThrow();
  });

  it('does not throw when onSelectImage is undefined and link is clicked', () => {
    render(<ImageLibrary images={[mockMeta]} isLoading={false} />);
    const link = screen.getByRole('link', { name: /Test/i });
    expect(() => fireEvent.click(link)).not.toThrow();
  });

  it('prevents default on link click', () => {
    const onSelectImage = vi.fn();
    render(
      <ImageLibrary
        images={[mockMeta]}
        isLoading={false}
        onSelectImage={onSelectImage}
      />
    );
    const link = screen.getByRole('link', { name: /Test/i });
    const event = new MouseEvent('click', { bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    fireEvent(link, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('shows dimensions when meta has width and height', () => {
    render(
      <ImageLibrary
        images={[mockMeta]}
        isLoading={false}
        onSelectImage={vi.fn()}
      />
    );
    expect(screen.getByText(/100x100/)).toBeInTheDocument();
  });
});
