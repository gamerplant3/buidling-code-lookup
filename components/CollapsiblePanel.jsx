'use client';

import { useEffect, useState } from 'react';

/**
 * Collapsible sidebar section (manual toggle).
 * `openWhen` forces open when true (e.g. editing a selected site).
 */
export default function CollapsiblePanel({
  title,
  children,
  defaultOpen = false,
  openWhen = false,
  className = 'panel',
}) {
  const [open, setOpen] = useState(defaultOpen || openWhen);

  useEffect(() => {
    if (openWhen) setOpen(true);
  }, [openWhen]);

  return (
    <section className={className}>
      <button
        type="button"
        className="collapsible-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="collapsible-chevron" data-open={open ? '1' : '0'}>
          ▶
        </span>
        <span className="collapsible-title">{title}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  );
}
