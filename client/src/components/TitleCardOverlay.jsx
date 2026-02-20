import { useEffect } from 'react';

function TitleCardOverlay({ onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'title-card-close') onClose();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onClose]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClose();
        }
      }}
      aria-label="Click to close and show app"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        cursor: 'pointer',
        background: '#0A0A0A',
      }}
    >
      <iframe
        src="/movie/title-card.html"
        title="Color Palette Maker Title Card"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}

export default TitleCardOverlay;
