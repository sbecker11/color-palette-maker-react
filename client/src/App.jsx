import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import api from './api';
import { getFilenameFromMeta, getFilenameWithoutExt } from './utils';
import {
  needsPaletteGeneration,
  getNextSelectionAfterDeletion,
  computeReorderedState,
  shouldSavePaletteName,
  buildExportData,
  applyPaletteToMeta,
  applyPaletteToImages,
  computeSwatchLabels,
  applyPaletteNameToImages,
  applyRegionsToMeta,
  computeRegionLabels,
  normalizeMetaPaletteRegion,
} from './AppHelpers';
import Header from './components/Header';
import TitleCardOverlay from './components/TitleCardOverlay';
import UploadForm from './components/UploadForm';
import ImageLibrary from './components/ImageLibrary';
import PaletteDisplay from './components/PaletteDisplay';
import ImageViewer from './components/ImageViewer';
import './App.css';

const initialRegionsState = { regions: [], isDeleteRegionMode: false, regionsDetecting: false };
function regionsReducer(state, action) {
  switch (action.type) {
    case 'SET_REGIONS':
      return { ...state, regions: action.payload };
    case 'SET_DELETE_MODE':
      return { ...state, isDeleteRegionMode: action.payload };
    case 'SET_DETECTING':
      return { ...state, regionsDetecting: action.payload };
    case 'REMOVE_REGION':
      return { ...state, regions: state.regions.filter((_, i) => i !== action.payload) };
    default:
      return state;
  }
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [images, setImages] = useState([]);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [paletteGenerating, setPaletteGenerating] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [paletteName, setPaletteName] = useState('');
  const [isSamplingMode, setIsSamplingMode] = useState(false);
  const [currentSampledColor, setCurrentSampledColor] = useState(null);
  const [regionsState, dispatchRegions] = useReducer(regionsReducer, initialRegionsState);
  const { regions, isDeleteRegionMode, regionsDetecting } = regionsState;
  const [showMatchPaletteSwatches, setShowMatchPaletteSwatches] = useState(false);
  const [pairingsNeeded, setPairingsNeeded] = useState(false);
  const [showTitleCard, setShowTitleCard] = useState(false);
  // One palette swatch may map to zero or more overlays (sync highlight between panel swatch and image overlays)
  const [hoveredSwatchIndex, setHoveredSwatchIndex] = useState(null);

  // REFRESH PAIRINGS: when Match Region Swatches is on and pairingsNeeded, recompute region-to-swatch pairings
  useEffect(() => {
    if (!showMatchPaletteSwatches || !pairingsNeeded || !selectedMeta) return;
    const filename = getFilenameFromMeta(selectedMeta);
    const palette = selectedMeta?.colorPalette;
    const regs = regionsState.regions;
    if (!filename || !Array.isArray(palette) || palette.length === 0 || !Array.isArray(regs) || regs.length === 0) {
      setPairingsNeeded(false);
      return;
    }
    setPairingsNeeded(false);
    api.refreshPairings(filename).then((result) => {
      if (result.success && Array.isArray(result.paletteRegion)) {
        setSelectedMeta((prev) => prev && getFilenameFromMeta(prev) === filename ? { ...prev, paletteRegion: result.paletteRegion } : prev);
        setImages((prev) =>
          prev.map((m) =>
            getFilenameFromMeta(m) === filename ? { ...m, paletteRegion: result.paletteRegion } : m
          )
        );
      }
    }).catch(() => {});
  }, [showMatchPaletteSwatches, pairingsNeeded, selectedMeta, regionsState.regions]);

  // Apply theme to document
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Clear swatch highlight when match palette swatches is turned off
  useEffect(() => {
    if (!showMatchPaletteSwatches) setHoveredSwatchIndex(null);
  }, [showMatchPaletteSwatches]);

  const showMessage = useCallback((text, isError = false) => {
    setMessage({ text, isError });
    if (text) {
      setTimeout(() => setMessage({ text: '', isError: false }), 5000);
    }
  }, []);

  const loadImages = useCallback(async (opts = {}) => {
    const { selectFirst = true } = opts;
    setIsLoading(true);
    try {
      const data = await api.getImages();
      if (data.success && data.images) {
        const normalized = data.images.map(normalizeMetaPaletteRegion);
        setImages(normalized);
        if (normalized.length > 0 && selectFirst) {
          const first = normalized[0];
          const filename = getFilenameFromMeta(first);
          if (filename) {
            setSelectedMeta(first);
            setSelectedImageUrl(`/uploads/${encodeURIComponent(filename)}`);
            setPaletteName(first.paletteName || getFilenameWithoutExt(filename));
            dispatchRegions({ type: 'SET_REGIONS', payload: Array.isArray(first.regions) ? first.regions : [] });
            if (needsPaletteGeneration(first)) {
              setPaletteGenerating(true);
              api
                .generatePalette(filename)
                .then((result) => {
                  if (result.success && result.palette) {
                    setSelectedMeta((prev) =>
                      prev && getFilenameFromMeta(prev) === filename
                        ? applyPaletteToMeta(prev, result.palette)
                        : prev
                    );
                    setImages((prev) => applyPaletteToImages(prev, filename, result.palette));
                  }
                })
                .finally(() => setPaletteGenerating(false));
            }
          }
        }
      } else {
        setImages([]);
        showMessage(data.message || 'Could not load images', true);
      }
    } catch {
      console.error('Failed to load image list.');
      setImages([]);
      showMessage('Error loading image list.', true);
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: load once on app init
  }, []);

  useEffect(() => {
    api.getConfig().then((data) => {
      if (data?.titleCard) {
        setShowTitleCard(true);
      }
    });
  }, []);

  // Update selected image when images change (e.g. after upload)
  useEffect(() => {
    if (images.length > 0 && selectedMeta) {
      const filename = getFilenameFromMeta(selectedMeta);
      const stillExists = images.some((m) => getFilenameFromMeta(m) === filename);
      if (!stillExists) {
        const first = images[0];
        const fn = getFilenameFromMeta(first);
        if (fn) {
          setSelectedMeta(first);
          setSelectedImageUrl(`/uploads/${encodeURIComponent(fn)}`);
          setPaletteName(first.paletteName || getFilenameWithoutExt(fn));
        }
      }
    }
  }, [images, selectedMeta]);

  const handleSelectImage = useCallback((meta, imageUrl, opts = {}) => {
    const { skipPaletteGeneration = false } = opts;
    setIsSamplingMode(false);
    setCurrentSampledColor(null);
    dispatchRegions({ type: 'SET_DELETE_MODE', payload: false });
    setSelectedMeta(meta);
    setSelectedImageUrl(imageUrl);
    setPaletteName(meta.paletteName || getFilenameWithoutExt(getFilenameFromMeta(meta) || ''));
    dispatchRegions({ type: 'SET_REGIONS', payload: Array.isArray(meta.regions) ? meta.regions : [] });

    if (skipPaletteGeneration || !needsPaletteGeneration(meta)) {
      setPaletteGenerating(false);
    } else {
      const filename = getFilenameFromMeta(meta);
      if (filename) {
        setPaletteGenerating(true);
        api
          .generatePalette(filename)
          .then((result) => {
            if (result.success && result.palette) {
              setSelectedMeta((prev) =>
                prev && getFilenameFromMeta(prev) === filename
                  ? applyPaletteToMeta(prev, result.palette)
                  : prev
              );
              setImages((prev) => applyPaletteToImages(prev, filename, result.palette));
            }
          })
          .finally(() => setPaletteGenerating(false));
      } else {
        setPaletteGenerating(false);
      }
    }
  }, []);

  const handleUpload = useCallback(
    async (formData) => {
      showMessage('Processing...');
      try {
        const result = await api.upload(formData);
        if (result.success) {
          showMessage('Success: Image processed.');
          await loadImages({ selectFirst: false });
          if (result.metadata) {
            const filename = getFilenameFromMeta(result.metadata);
            if (filename) {
              handleSelectImage(result.metadata, `/uploads/${encodeURIComponent(filename)}`, {
                skipPaletteGeneration: true,
              });
            }
          }
          return result;
        } else {
          showMessage(result.message || 'An error occurred.', true);
          return result;
        }
      } catch {
        showMessage('Submission failed. Check console.', true);
        return { success: false };
      }
    },
    [showMessage, loadImages, handleSelectImage]
  );

  const handleReorder = useCallback(
    async (index, direction) => {
      const state = computeReorderedState(images, index, direction);
      if (!state) return;

      const { reordered, filenames } = state;
      const prevImages = images;
      setImages(reordered);
      let newIndex;
      if (direction === 'top') {
        newIndex = 0;
      } else if (direction === 'bottom') {
        newIndex = reordered.length - 1;
      } else if (direction === 'up') {
        newIndex = index - 1;
      } else if (direction === 'down') {
        newIndex = index + 1;
      } else {
        newIndex = index;
      }
      if (newIndex >= 0 && newIndex < reordered.length) {
        const movedMeta = reordered[newIndex];
        const filename = getFilenameFromMeta(movedMeta);
        if (filename) {
          handleSelectImage(movedMeta, `/uploads/${encodeURIComponent(filename)}`, {
            skipPaletteGeneration: true,
          });
        }
      }
      try {
        const result = await api.reorderImages(filenames);
        if (!result.success) {
          setImages(prevImages);
          showMessage(result.message || 'Failed to reorder.', true);
        }
      } catch {
        setImages(prevImages);
        showMessage('Failed to reorder.', true);
      }
    },
    [images, showMessage, handleSelectImage]
  );

  const handleDeleteImage = useCallback(
    async (filename) => {
      if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
      showMessage('Deleting...');
      try {
        const result = await api.deleteImage(filename);
        if (result.success) {
          showMessage('Image deleted successfully.');
          const wasSelected = selectedMeta && getFilenameFromMeta(selectedMeta) === filename;
          setImages((prev) => prev.filter((m) => getFilenameFromMeta(m) !== filename));
          if (wasSelected) {
            setSelectedMeta(null);
            setSelectedImageUrl('');
            setPaletteName('');
            const remaining = images.filter((m) => getFilenameFromMeta(m) !== filename);
            const next = getNextSelectionAfterDeletion(remaining);
            if (next) {
              handleSelectImage(next.meta, next.imageUrl);
            }
          }
        } else {
          showMessage(result.message || 'Error deleting image.', true);
        }
      } catch {
        showMessage('Failed to delete image.', true);
      }
    },
    [selectedMeta, images, showMessage, handleSelectImage]
  );

  const handleDeleteSwatch = useCallback(
    async (hexColor) => {
      if (!selectedMeta) return;
      const palette = selectedMeta.colorPalette || [];
      if (!Array.isArray(palette) || !palette.includes(hexColor)) return;

      const newPalette = palette.filter((c) => c !== hexColor);
      const filename = getFilenameFromMeta(selectedMeta);
      const updatedMeta = applyPaletteToMeta(selectedMeta, newPalette);
      setSelectedMeta(updatedMeta);
      setImages((prev) => applyPaletteToImages(prev, filename, newPalette));
      if (filename) {
        try {
          const labels = computeSwatchLabels(newPalette);
          const result = await api.savePalette(filename, newPalette, labels);
          if (!result.success) {
            showMessage(result.message || 'Error saving palette.', true);
          } else if (showMatchPaletteSwatches) {
            setPairingsNeeded(true);
          }
        } catch {
          showMessage('Network error saving palette update.', true);
        }
      }
    },
    [selectedMeta, showMessage, showMatchPaletteSwatches]
  );

  const handleClearAllSwatches = useCallback(async () => {
    if (!selectedMeta) return;
    const filename = getFilenameFromMeta(selectedMeta);
    const newPalette = [];
    const updatedMeta = applyPaletteToMeta(selectedMeta, newPalette);
    setSelectedMeta(updatedMeta);
    setImages((prev) => applyPaletteToImages(prev, filename, newPalette));
    if (filename) {
      try {
        const result = await api.savePalette(filename, newPalette, []);
        if (!result.success) showMessage(result.message || 'Error clearing palette.', true);
        else {
          showMessage('All swatches cleared.');
          if (showMatchPaletteSwatches) setPairingsNeeded(true);
        }
      } catch {
        showMessage('Network error clearing palette.', true);
      }
    }
  }, [selectedMeta, showMessage, showMatchPaletteSwatches]);

  const handleToggleSamplingMode = useCallback(() => {
    if (!selectedMeta) {
      showMessage('Select an image first.', true);
      return;
    }
    if (isSamplingMode) {
      setIsSamplingMode(false);
      setCurrentSampledColor(null);
      document.body.classList.remove('sampling-active');
    } else {
      dispatchRegions({ type: 'SET_DELETE_MODE', payload: false });
      setIsSamplingMode(true);
      setCurrentSampledColor(null);
      document.body.classList.add('sampling-active');
    }
  }, [selectedMeta, isSamplingMode, showMessage]);

  const handleAddingSwatchesModeChange = useCallback((checked) => {
    if (checked && !selectedMeta) {
      showMessage('Select an image first.', true);
      return;
    }
    if (checked) {
      dispatchRegions({ type: 'SET_DELETE_MODE', payload: false });
      setIsSamplingMode(true);
      setCurrentSampledColor(null);
      document.body.classList.add('sampling-active');
    } else {
      setIsSamplingMode(false);
      setCurrentSampledColor(null);
      document.body.classList.remove('sampling-active');
    }
  }, [selectedMeta, showMessage]);

  const handleExitAddingSwatchesMode = useCallback(() => {
    if (isSamplingMode) {
      setIsSamplingMode(false);
      setCurrentSampledColor(null);
      document.body.classList.remove('sampling-active');
    }
  }, [isSamplingMode]);

  useEffect(() => {
    return () => document.body.classList.remove('sampling-active');
  }, []);

  const handleDoubleClickAddColor = useCallback((hexColor) => {
    if (!isSamplingMode || !selectedMeta || !hexColor) return;

    const palette = selectedMeta.colorPalette || [];
    if (palette.includes(hexColor)) return;

    const newPalette = [...palette, hexColor];
    const updatedMeta = applyPaletteToMeta(selectedMeta, newPalette);
    const filename = getFilenameFromMeta(selectedMeta);
    setSelectedMeta(updatedMeta);
    setImages((prev) => applyPaletteToImages(prev, filename, newPalette));

    if (filename) {
      const labels = computeSwatchLabels(newPalette);
      api.savePalette(filename, newPalette, labels).then(() => {
        if (showMatchPaletteSwatches) setPairingsNeeded(true);
      }).catch(() => {
        showMessage('Error saving palette.', true);
      });
    }
  }, [isSamplingMode, selectedMeta, showMessage, showMatchPaletteSwatches]);

  const handlePaletteNameBlur = useCallback(() => {
    if (!shouldSavePaletteName(selectedMeta, paletteName)) return;

    const filename = getFilenameFromMeta(selectedMeta);
    const name = paletteName.trim();
    api
      .saveMetadata(filename, { paletteName: name })
      .then((result) => {
        if (result.success) {
          showMessage('Palette name updated.', false);
          setSelectedMeta((prev) => (prev ? { ...prev, paletteName: name } : prev));
          setImages((prev) => applyPaletteNameToImages(prev, filename, name));
        } else {
          showMessage(result.message || 'Error saving name.', true);
        }
      })
      .catch(() => showMessage('Network error saving palette name.', true));
  }, [selectedMeta, paletteName, showMessage]);

  const handleExport = useCallback(() => {
    const payload = buildExportData(selectedMeta, paletteName);
    if (!payload) {
      showMessage(
        selectedMeta ? 'No colors in the current palette to export.' : 'Please select an image first.',
        true
      );
      return;
    }

    const { name, colors } = payload;
    const jsonData = { name, colors };
    const blob = new Blob([JSON.stringify(jsonData, null, 2) + '\n'], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const downloadFilenameBase = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || 'palette';
    link.download = `${downloadFilenameBase}.json`;
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage(`Export initiated for "${link.download}". Check your browser downloads.`);
  }, [selectedMeta, paletteName, showMessage]);

  const handleDuplicateImage = useCallback(async (filename) => {
    if (!filename) return;
    try {
      const result = await api.duplicateImage(filename);
      if (result.success && result.metadata) {
        await loadImages({ selectFirst: false });
        const newFilename = result.filename;
        const newMeta = result.metadata;
        handleSelectImage(newMeta, `/uploads/${encodeURIComponent(newFilename)}`);
        showMessage(`Created duplicate: ${result.metadata.paletteName || newFilename}`);
      } else {
        showMessage(result.message || 'Failed to duplicate.', true);
      }
    } catch {
      showMessage('Failed to duplicate.', true);
    }
  }, [showMessage, loadImages, handleSelectImage]);

  const handleDelete = useCallback(() => {
    if (!selectedMeta) return;
    const filename = getFilenameFromMeta(selectedMeta);
    if (filename) handleDeleteImage(filename);
  }, [selectedMeta, handleDeleteImage]);

  const handleDuplicate = useCallback(() => {
    if (!selectedMeta) {
      showMessage('Please select an image first.', true);
      return;
    }
    const filename = getFilenameFromMeta(selectedMeta);
    if (filename) handleDuplicateImage(filename);
  }, [selectedMeta, showMessage, handleDuplicateImage]);

  const handleRegenerateWithK = useCallback((k) => {
    if (!selectedMeta) {
      showMessage('Please select an image first.', true);
      return;
    }
    const filename = getFilenameFromMeta(selectedMeta);
    if (!filename) return;

    setPaletteGenerating(true);
    const opts = { regenerate: true, k };
    if (regions && regions.length > 0) opts.regions = regions;
    api
      .generatePalette(filename, opts)
      .then((result) => {
        if (result.success && result.palette) {
          const paletteRegions = Array.isArray(result.paletteRegion) ? result.paletteRegion : [];
          const updatedMeta = {
            ...applyPaletteToMeta(selectedMeta, result.palette),
            paletteRegion: paletteRegions,
          };
          setSelectedMeta(updatedMeta);
          setImages((prev) =>
            prev.map((m) =>
              getFilenameFromMeta(m) === filename
                ? { ...m, colorPalette: result.palette, paletteRegion: paletteRegions }
                : m
            )
          );
          if (showMatchPaletteSwatches) setPairingsNeeded(true);
          showMessage(
            regions?.length
              ? `Palette by regions with K-means (${k}).`
              : `Palette regenerated with K-means (${k}).`
          );
        } else {
          showMessage(result.message || 'Failed to regenerate palette.', true);
        }
      })
      .catch(() => showMessage('Failed to regenerate palette.', true))
      .finally(() => setPaletteGenerating(false));
  }, [selectedMeta, regions, showMessage, showMatchPaletteSwatches]);

  const handleDetectRegions = useCallback(async () => {
    if (!selectedMeta) {
      showMessage('Please select an image first.', true);
      return;
    }
    const filename = getFilenameFromMeta(selectedMeta);
    if (!filename) return;
    dispatchRegions({ type: 'SET_DETECTING', payload: true });
    try {
      const result = await api.detectRegions(filename);
      if (result.success && result.regions) {
        const newRegions = result.regions;
        const newPaletteRegions = Array.isArray(result.paletteRegion) ? result.paletteRegion : [];
        dispatchRegions({ type: 'SET_REGIONS', payload: newRegions });
        setSelectedMeta((prev) =>
          prev ? { ...applyRegionsToMeta(prev, newRegions), paletteRegion: newPaletteRegions } : prev
        );
        setImages((prev) =>
          prev.map((m) =>
            getFilenameFromMeta(m) === filename
              ? { ...m, ...applyRegionsToMeta(m, newRegions), paletteRegion: newPaletteRegions }
              : m
          )
        );
        dispatchRegions({ type: 'SET_DELETE_MODE', payload: true });
        if (showMatchPaletteSwatches) setPairingsNeeded(true);
        showMessage(`Detected ${newRegions.length} region(s). Saved. Click to remove unwanted; click outside to exit.`);
      } else {
        showMessage(result.message || result.error || 'Region detection failed.', true);
      }
    } catch {
      showMessage('Region detection failed. Region detection requires Python 3 with opencv-python and numpy. Ensure Installation (step 3) is complete.', true);
    } finally {
      dispatchRegions({ type: 'SET_DETECTING', payload: false });
    }
  }, [selectedMeta, showMessage, showMatchPaletteSwatches]);

  const handleDeleteRegions = useCallback(async () => {
    if (!selectedMeta) return;
    const filename = getFilenameFromMeta(selectedMeta);
    if (!filename) return;
    const emptyRegions = [];
    const emptyPaletteRegions = [];
    dispatchRegions({ type: 'SET_REGIONS', payload: emptyRegions });
    setSelectedMeta((prev) => (prev ? { ...applyRegionsToMeta(prev, emptyRegions), paletteRegion: emptyPaletteRegions } : prev));
    setImages((prev) =>
      prev.map((m) =>
        getFilenameFromMeta(m) === filename
          ? { ...m, ...applyRegionsToMeta(m, emptyRegions), paletteRegion: emptyPaletteRegions }
          : m
      )
    );
    dispatchRegions({ type: 'SET_DELETE_MODE', payload: false });
    if (showMatchPaletteSwatches) setPairingsNeeded(true);
    try {
      await api.saveMetadata(filename, { regions: emptyRegions, regionLabels: [] });
      showMessage('Regions cleared.');
    } catch {
      showMessage('Failed to save.', true);
    }
  }, [selectedMeta, showMessage, showMatchPaletteSwatches]);

  const handleRegionClick = useCallback((index) => {
    if (!selectedMeta) return;
    const filename = getFilenameFromMeta(selectedMeta);
    if (!filename) return;
    const updated = regions.filter((_, i) => i !== index);
    const paletteRegions = selectedMeta?.paletteRegion ?? [];
    const updatedPaletteRegions = (Array.isArray(paletteRegions) ? paletteRegions : []).filter((_, i) => i !== index);
    const updatedLabels = computeRegionLabels(updated);
    dispatchRegions({ type: 'REMOVE_REGION', payload: index });
    if (updated.length === 0) dispatchRegions({ type: 'SET_DELETE_MODE', payload: false });
    setSelectedMeta((prev) => (prev ? { ...applyRegionsToMeta(prev, updated), paletteRegion: updatedPaletteRegions } : prev));
    setImages((prev) =>
      prev.map((m) =>
        getFilenameFromMeta(m) === filename
          ? { ...m, ...applyRegionsToMeta(m, updated), paletteRegion: updatedPaletteRegions }
          : m
      )
    );
    if (showMatchPaletteSwatches) setPairingsNeeded(true);
    api.saveMetadata(filename, { regions: updated, regionLabels: updatedLabels }).catch(() => {
      showMessage('Failed to save region change.', true);
    });
  }, [selectedMeta, regions, showMessage, showMatchPaletteSwatches]);

  const handleEnterDeleteRegionMode = useCallback(() => {
    if (isSamplingMode) {
      setIsSamplingMode(false);
      setCurrentSampledColor(null);
      document.body.classList.remove('sampling-active');
    }
    dispatchRegions({ type: 'SET_DELETE_MODE', payload: true });
    showMessage('Click a region to remove it; click outside the image to exit.');
  }, [showMessage, isSamplingMode]);

  const handleExitDeleteRegionMode = useCallback(() => {
    dispatchRegions({ type: 'SET_DELETE_MODE', payload: false });
  }, []);

  const handleDeleteRegionModeChange = useCallback((checked) => {
    if (checked && isSamplingMode) {
      setIsSamplingMode(false);
      setCurrentSampledColor(null);
      document.body.classList.remove('sampling-active');
    }
    dispatchRegions({ type: 'SET_DELETE_MODE', payload: checked });
    if (checked) showMessage('Click a region to remove it; click outside the image to exit.');
  }, [showMessage, isSamplingMode]);

  const palettePanelRef = useRef(null);
  const palette = selectedMeta?.colorPalette;
  const swatchLabels = selectedMeta?.swatchLabels &&
    Array.isArray(selectedMeta.swatchLabels) &&
    selectedMeta.swatchLabels.length === (palette?.length ?? 0)
    ? selectedMeta.swatchLabels
    : computeSwatchLabels(palette || []);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <>
      {showTitleCard && (
        <TitleCardOverlay onClose={() => setShowTitleCard(false)} />
      )}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onTitleClick={() => setShowTitleCard(true)}
      />
      <main>
        <div id="leftPanel">
          <UploadForm onSubmit={handleUpload} message={message} />
          <ImageLibrary
            images={images}
            selectedMeta={selectedMeta}
            onSelectImage={handleSelectImage}
            onDeleteImage={handleDeleteImage}
            onDuplicateImage={handleDuplicateImage}
            onReorder={handleReorder}
            isLoading={isLoading}
          />
        </div>
        <PaletteDisplay
          palettePanelRef={palettePanelRef}
          palette={palette}
          swatchLabels={swatchLabels}
          isGenerating={paletteGenerating}
          isSamplingMode={isSamplingMode}
          currentSampledColor={currentSampledColor}
          onToggleSamplingMode={handleToggleSamplingMode}
          onAddingSwatchesModeChange={handleAddingSwatchesModeChange}
          onDeleteSwatch={handleDeleteSwatch}
          onClearAllSwatches={handleClearAllSwatches}
          paletteName={paletteName}
          onPaletteNameChange={setPaletteName}
          onExport={handleExport}
          onRegenerateWithK={handleRegenerateWithK}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onPaletteNameBlur={handlePaletteNameBlur}
          selectedMeta={selectedMeta}
          onDetectRegions={handleDetectRegions}
          onDeleteRegions={handleDeleteRegions}
          onEnterDeleteRegionMode={handleEnterDeleteRegionMode}
          isDeleteRegionMode={isDeleteRegionMode}
          onDeleteRegionModeChange={handleDeleteRegionModeChange}
          regionsDetecting={regionsDetecting}
          hasRegions={regions && regions.length > 0}
          showMatchPaletteSwatches={showMatchPaletteSwatches}
          onShowMatchPaletteSwatchesChange={(checked) => {
            setShowMatchPaletteSwatches(checked);
            if (checked) setPairingsNeeded(true);
          }}
          hoveredSwatchIndex={hoveredSwatchIndex}
          onSwatchHover={setHoveredSwatchIndex}
        />
        <ImageViewer
          palettePanelRef={palettePanelRef}
          imageUrl={selectedImageUrl}
          imageAlt={paletteName || (selectedMeta ? getFilenameWithoutExt(getFilenameFromMeta(selectedMeta)) : null)}
          isSamplingMode={isSamplingMode}
          onSampledColorChange={setCurrentSampledColor}
          onDoubleClickAddColor={handleDoubleClickAddColor}
          onExitAddingSwatchesMode={handleExitAddingSwatchesMode}
          regions={regions}
          paletteRegion={selectedMeta?.paletteRegion}
          regionLabels={
            selectedMeta?.regionLabels &&
            Array.isArray(selectedMeta.regionLabels) &&
            selectedMeta.regionLabels.length === (regions?.length ?? 0)
              ? selectedMeta.regionLabels
              : computeRegionLabels(regions || [])
          }
          isDeleteRegionMode={isDeleteRegionMode}
          onRegionClick={handleRegionClick}
          onExitDeleteRegionMode={handleExitDeleteRegionMode}
          showMatchPaletteSwatches={showMatchPaletteSwatches}
          palette={palette}
          swatchLabels={swatchLabels}
          hoveredSwatchIndex={hoveredSwatchIndex}
          onSwatchHover={setHoveredSwatchIndex}
        />
      </main>
    </>
  );
}

export default App;
