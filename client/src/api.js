/**
 * API helpers for Color Palette Maker
 */

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { success: false, message: data.message || `HTTP ${response.status}` };
  }
  return data;
}

const api = {
  async getConfig() {
    const response = await fetch('/api/config');
    return handleResponse(response);
  },

  async getImages() {
    const response = await fetch('/api/images');
    return handleResponse(response);
  },

  async upload(formData) {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
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
    return handleResponse(response);
  },

  async detectRegions(filename) {
    const response = await fetch(`/api/regions/${encodeURIComponent(filename)}`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async refreshPairings(filename) {
    const response = await fetch(`/api/pairings/${encodeURIComponent(filename)}`, {
      method: 'POST',
    });
    return handleResponse(response);
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
    return handleResponse(response);
  },

  async saveMetadata(filename, opts = {}) {
    const { paletteName, regions, regionLabels } = typeof opts === 'string' ? { paletteName: opts } : opts;
    const body = {};
    if (paletteName !== undefined) body.paletteName = paletteName;
    if (regions !== undefined) body.regions = regions;
    if (regionLabels !== undefined && Array.isArray(regionLabels) && regionLabels.length === (regions?.length ?? 0)) {
      body.regionLabels = regionLabels;
    }
    if (Object.keys(body).length === 0) return { success: false, message: 'Nothing to save.' };
    const response = await fetch(`/api/metadata/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async deleteImage(filename) {
    const response = await fetch(`/api/images/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async duplicateImage(filename) {
    const response = await fetch(`/api/images/${encodeURIComponent(filename)}/duplicate`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async reorderImages(filenames) {
    const response = await fetch('/api/images/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames }),
    });
    return handleResponse(response);
  },
};

export default api;
