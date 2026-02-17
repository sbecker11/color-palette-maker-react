import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from './api';

describe('api', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('getImages fetches /api/images', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, images: [] }),
    });

    await api.getImages();

    expect(global.fetch).toHaveBeenCalledWith('/api/images');
  });

  it('upload posts to /upload with FormData', async () => {
    const formData = new FormData();
    formData.append('uploadType', 'url');
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    await api.upload(formData);

    expect(global.fetch).toHaveBeenCalledWith('/upload', {
      method: 'POST',
      body: formData,
    });
  });

  it('generatePalette posts to /api/palette/:filename', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, palette: [] }),
    });

    await api.generatePalette('img-123.jpeg');

    expect(global.fetch).toHaveBeenCalledWith('/api/palette/img-123.jpeg', {
      method: 'POST',
    });
  });

  it('savePalette puts to /api/palette/:filename with JSON body', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    await api.savePalette('img-123.jpeg', ['#ff0000', '#00ff00']);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/palette/img-123.jpeg',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorPalette: ['#ff0000', '#00ff00'] }),
      })
    );
  });

  it('savePalette includes swatchLabels when provided', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    await api.savePalette('img-123.jpeg', ['#ff0000', '#00ff00'], ['A', 'B']);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/palette/img-123.jpeg',
      expect.objectContaining({
        body: JSON.stringify({ colorPalette: ['#ff0000', '#00ff00'], swatchLabels: ['A', 'B'] }),
      })
    );
  });

  it('deleteImage sends DELETE request', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    await api.deleteImage('img-123.jpeg');

    expect(global.fetch).toHaveBeenCalledWith('/api/images/img-123.jpeg', {
      method: 'DELETE',
    });
  });

  it('generatePalette with regenerate=true adds query param', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, palette: [] }),
    });

    await api.generatePalette('img-123.jpeg', { regenerate: true });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/palette/img-123.jpeg?regenerate=true',
      { method: 'POST' }
    );
  });

  it('duplicateImage posts to /api/images/:filename/duplicate', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, filename: 'img-456.jpeg', metadata: {} }),
    });

    await api.duplicateImage('img-123.jpeg');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/images/img-123.jpeg/duplicate',
      { method: 'POST' }
    );
  });

  it('saveMetadata puts to /api/metadata/:filename with paletteName', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    await api.saveMetadata('img-123.jpeg', 'My Palette');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/metadata/img-123.jpeg',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paletteName: 'My Palette' }),
      })
    );
  });

  it('reorderImages puts to /api/images/order with filenames', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    await api.reorderImages(['img-1.jpeg', 'img-2.jpeg']);

    expect(global.fetch).toHaveBeenCalledWith('/api/images/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: ['img-1.jpeg', 'img-2.jpeg'] }),
    });
  });
});
