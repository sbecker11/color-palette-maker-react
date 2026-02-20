function Header({ theme, onToggleTheme, onTitleClick }) {
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
      <button id="themeToggleButton" onClick={onToggleTheme}>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
    </header>
  );
}

export default Header;
