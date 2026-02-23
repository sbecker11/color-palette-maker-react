import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetadataDisplay from './MetadataDisplay';

describe('MetadataDisplay', () => {
  it('shows placeholder when no meta', () => {
    render(<MetadataDisplay meta={null} />);
    expect(screen.getByText(/select an image from the list/i)).toBeInTheDocument();
  });

  it('shows metadata when meta provided', () => {
    const meta = {
      cachedFilePath: '/uploads/img-123.jpeg',
      width: 100,
      height: 200,
      format: 'jpeg',
      fileSizeBytes: 1024,
      createdDateTime: '2025-01-01T00:00:00Z',
    };
    render(<MetadataDisplay meta={meta} />);
    expect(screen.getByRole('list')).toHaveTextContent('img-123.jpeg');
    expect(screen.getByText(/100 x 200/i)).toBeInTheDocument();
    expect(screen.getByText('Format:', { exact: false })).toBeInTheDocument();
  });

  it('shows uploadedURL as link when provided', () => {
    const meta = {
      cachedFilePath: '/uploads/img.jpeg',
      uploadedURL: 'https://example.com/image.jpg',
      width: 50,
      height: 50,
      fileSizeBytes: 500,
    };
    render(<MetadataDisplay meta={meta} />);
    const link = screen.getByRole('link', { name: 'https://example.com/image.jpg' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/image.jpg');
  });

  it('shows Local path when uploadedFilePath provided', () => {
    const meta = {
      cachedFilePath: '/uploads/img.jpeg',
      uploadedFilePath: '/path/to/file.jpg',
      width: 50,
      height: 50,
      fileSizeBytes: 500,
    };
    render(<MetadataDisplay meta={meta} />);
    expect(screen.getByText(/Local: \/path\/to\/file.jpg/)).toBeInTheDocument();
  });

  it('shows N/A for dimensions when width or height missing', () => {
    const meta = {
      cachedFilePath: '/uploads/img.jpeg',
      fileSizeBytes: 100,
    };
    render(<MetadataDisplay meta={meta} />);
    const dimsLi = screen.getByText('Dimensions:', { exact: false }).closest('li');
    expect(dimsLi).toHaveTextContent('N/A');
  });

  it('shows unknown filename when getFilenameFromMeta returns null', () => {
    const meta = { fileSizeBytes: 100 };
    render(<MetadataDisplay meta={meta} />);
    const filenameLi = screen.getByText('Filename:', { exact: false }).closest('li');
    expect(filenameLi).toHaveTextContent('unknown');
  });

  it('shows N/A for format when format missing', () => {
    const meta = {
      cachedFilePath: '/uploads/img.jpeg',
      width: 10,
      height: 10,
      fileSizeBytes: 100,
    };
    render(<MetadataDisplay meta={meta} />);
    const formatLi = screen.getByText('Format:', { exact: false }).closest('li');
    expect(formatLi).toHaveTextContent('N/A');
  });

  it('shows formatted file size', () => {
    const meta = {
      cachedFilePath: '/uploads/img.jpeg',
      width: 10,
      height: 10,
      fileSizeBytes: 2048,
      format: 'jpeg',
    };
    render(<MetadataDisplay meta={meta} />);
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });
});
