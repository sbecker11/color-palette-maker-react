/**
 * API helpers for Color Palette Maker
 */

const api = {
  async getImages() {
    const response = await fetch('/api/images');
    return response.json();
  },

  async upload(formData) {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  async generatePalette(filename, opts = {}) {
    const { regenerate = false, k, regions } = opts;
    const params = new URLSearchParams();
    if (regenerate) params.set('regenerate', 'true');
    if (k != null && k >= 2 && k <= 20) params.set('k', String(k));
    const qs = params.toString();
    const url = `/api/palette/${encodeURIComponent(filename)}${qs ? `?${qs}` : ''}`;
    const fetchOpts = { method: 'POST' };
    if (regions && regions.length > 0) {
      fetchOpts.headers = { 'Content-Type': 'application/json' };
      fetchOpts.body = JSON.stringify({ regions, k, regenerate });
    }
    const response = await fetch(url, fetchOpts);
    return response.json();
  },

  async detectRegions(filename) {
    const response = await fetch(`/api/regions/${encodeURIComponent(filename)}`, {
      method: 'POST',
    });
    return response.json();
  },

  async savePalette(filename, colorPalette, swatchLabels) {
    const body = { colorPalette };
    if (Array.isArray(swatchLabels) && swatchLabels.length === colorPalette.length) {
      body.swatchLabels = swatchLabels;
    }
    const response = await fetch(`/api/palette/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async saveMetadata(filename, opts = {}) {
    const { paletteName, regions } = typeof opts === 'string' ? { paletteName: opts } : opts;
    const body = {};
    if (paletteName !== undefined) body.paletteName = paletteName;
    if (regions !== undefined) body.regions = regions;
    if (Object.keys(body).length === 0) return { success: false, message: 'Nothing to save.' };
    const response = await fetch(`/api/metadata/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async deleteImage(filename) {
    const response = await fetch(`/api/images/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  async duplicateImage(filename) {
    const response = await fetch(`/api/images/${encodeURIComponent(filename)}/duplicate`, {
      method: 'POST',
    });
    return response.json();
  },

  async reorderImages(filenames) {
    const response = await fetch('/api/images/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames }),
    });
    return response.json();
  },
};

export default api;
