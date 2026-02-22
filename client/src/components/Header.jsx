function Header({ theme, onToggleTheme, onTitleClick, onAboutClick }) {
  return (
    <header>
      <h1>
        <span
          className={`hero-title${onTitleClick ? ' hero-title-clickable' : ''}`}
          role={onTitleClick ? 'button' : undefined}
          tabIndex={onTitleClick ? 0 : undefined}
          onClick={onTitleClick}
          onKeyDown={
            onTitleClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTitleClick();
                  }
                }
              : undefined
          }
        >
          Color <em>Palette</em> Maker
        </span>
        <span className="header-tech">React • Vite</span>
      </h1>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onAboutClick && (
          <a href="/about.html" className="header-about-link" onClick={(e) => { e.preventDefault(); onAboutClick(); }}>About</a>
        )}
        <button id="themeToggleButton" onClick={onToggleTheme}>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
      </nav>
    </header>
  );
}

export default Header;
