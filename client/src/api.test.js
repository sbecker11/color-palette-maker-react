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
      ok: true,
      json: () => Promise.resolve({ success: true, images: [] }),
    });

    const result = await api.getImages();

    expect(global.fetch).toHaveBeenCalledWith('/api/images');
    expect(result).toEqual({ success: true, images: [] });
  });

  it('getImages returns error when response.ok is false', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    });

    const result = await api.getImages();

    expect(result).toEqual({ success: false, message: 'Server error' });
  });

  it('getImages returns HTTP status when error body has no message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });

    const result = await api.getImages();

    expect(result).toEqual({ success: false, message: 'HTTP 404' });
  });

  it('upload posts to /upload with FormData', async () => {
    const formData = new FormData();
    formData.append('uploadType', 'url');
    global.fetch.mockResolvedValueOnce({
      ok: true,
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
      ok: true,
      json: () => Promise.resolve({ success: true, palette: [] }),
    });

    await api.generatePalette('img-123.jpeg');

    expect(global.fetch).toHaveBeenCalledWith('/api/palette/img-123.jpeg', {
      method: 'POST',
    });
  });

  it('savePalette puts to /api/palette/:filename with JSON body', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
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
      ok: true,
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
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await api.deleteImage('img-123.jpeg');

    expect(global.fetch).toHaveBeenCalledWith('/api/images/img-123.jpeg', {
      method: 'DELETE',
    });
  });

  it('generatePalette with regenerate=true adds query param', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
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
      ok: true,
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
      ok: true,
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
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await api.reorderImages(['img-1.jpeg', 'img-2.jpeg']);

    expect(global.fetch).toHaveBeenCalledWith('/api/images/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: ['img-1.jpeg', 'img-2.jpeg'] }),
    });
  });

  it('generatePalette sends k param when in range', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, palette: [] }) });
    await api.generatePalette('img.jpeg', { regenerate: true, k: 7 });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/palette/img.jpeg?regenerate=true&k=7',
      expect.any(Object)
    );
  });

  it('generatePalette sends regions in body when provided', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, palette: [] }) });
    const regions = [[[0, 0], [10, 0], [10, 10]]];
    await api.generatePalette('img.jpeg', { regions, k: 5 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/palette/'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions, k: 5, regenerate: false }),
      })
    );
  });

  it('saveMetadata returns early when nothing to save', async () => {
    const result = await api.saveMetadata('img.jpeg', {});
    expect(result).toEqual({ success: false, message: 'Nothing to save.' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('saveMetadata with string opts treats as paletteName', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
    await api.saveMetadata('img.jpeg', 'My Name');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ paletteName: 'My Name' }),
      })
    );
  });

  it('detectRegions posts to /api/regions/:filename and returns result', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, regions: [[[0, 0], [10, 0]]] }),
    });
    const result = await api.detectRegions('img-123.jpeg');
    expect(global.fetch).toHaveBeenCalledWith('/api/regions/img-123.jpeg', { method: 'POST' });
    expect(result).toEqual({ success: true, regions: [[[0, 0], [10, 0]]] });
  });

  it('saveMetadata includes regionLabels when regions and valid regionLabels provided', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
    const regions = [[[0, 0], [10, 0], [10, 10]]];
    const regionLabels = ['00'];
    await api.saveMetadata('img.jpeg', { regions, regionLabels });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ regions, regionLabels }),
      })
    );
  });
});
