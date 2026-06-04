'use client';

/** Collapsible left/right sidebar rail. */
export default function CollapsibleRail({ side, title, open, onToggle, children }) {
  return (
    <aside
      className={`sidebar-rail sidebar-rail--${side}${open ? '' : ' sidebar-rail--collapsed'}`}
    >
      <div className="sidebar-rail-bar">
        <button
          type="button"
          className="sidebar-rail-toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          title={open ? `Collapse ${title}` : `Expand ${title}`}
        >
          <span className="sidebar-rail-menu" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>
        {open ? <span className="sidebar-rail-title">{title}</span> : null}
      </div>
      {open ? <div className="sidebar-rail-body">{children}</div> : null}
    </aside>
  );
}
