import { useEffect } from 'react';

function AboutOverlay({ onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'about-close') onClose();
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
        src={import.meta.env.MODE === 'test' ? 'about:blank' : '/about.html'}
        title="Color Palette Maker — About"
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

export default AboutOverlay;
