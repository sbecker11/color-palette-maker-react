import { useEffect } from 'react';

/**
 * Exit a mode when clicking outside the viewer, excluding palette panel.
 * @param {boolean} enabled - Whether the effect is active
 * @param {() => void} onExit - Callback when user clicks outside
 * @param {React.RefObject} viewerRef - Ref to the viewer container (clicks inside are ignored)
 * @param {React.RefObject} [palettePanelRef] - Ref to palette panel (clicks here are also ignored, so checkbox toggle handles exit)
 */
export function useClickOutsideToExit(enabled, onExit, viewerRef, palettePanelRef) {
  useEffect(() => {
    if (!enabled) return;
    const handleDocClick = (e) => {
      if (!viewerRef?.current) return;
      if (viewerRef.current.contains(e.target)) return;
      if (palettePanelRef?.current?.contains(e.target)) return;
      onExit?.();
    };
    document.addEventListener('mousedown', handleDocClick, true);
    return () => document.removeEventListener('mousedown', handleDocClick, true);
  }, [enabled, onExit, viewerRef, palettePanelRef]);
}
