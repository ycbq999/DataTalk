import { BookOpen, House, LayoutDashboard, LogIn, LogOut, PanelLeftClose, PanelLeftOpen, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { User } from './api';

const compactViewport = '(max-width: 760px)';
const sidebarPreference = 'thesiswatch.sidebar.collapsed';

function desktopNavigationExpanded() {
  try {
    return localStorage.getItem(sidebarPreference) !== 'true';
  } catch {
    return true;
  }
}

function NavigationLink({ href, label, icon: Icon, current, expanded, accent = false }: {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
  expanded: boolean;
  accent?: boolean;
}) {
  return (
    <a
      className={`button sidebar-link${accent ? ' button-primary' : ''}`}
      href={href}
      aria-current={current ? 'page' : undefined}
      title={expanded ? undefined : label}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="sidebar-label">{label}</span>
    </a>
  );
}

export function SiteNavigation({ route, user, showAccount, signingOut, onSignOut }: {
  route: string;
  user: User | null | undefined;
  showAccount: boolean;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const [expanded, setExpanded] = useState(() =>
    !window.matchMedia(compactViewport).matches && desktopNavigationExpanded(),
  );
  const toggle = useRef<HTMLButtonElement>(null);
  const toggleLabel = expanded ? 'Collapse navigation' : 'Expand navigation';
  const signOutLabel = signingOut ? 'Signing out…' : 'Sign out';

  useEffect(() => {
    const viewport = window.matchMedia(compactViewport);
    function updateExpansion() {
      setExpanded(!viewport.matches && desktopNavigationExpanded());
    }
    viewport.addEventListener('change', updateExpansion);
    return () => viewport.removeEventListener('change', updateExpansion);
  }, []);

  function changeExpansion(next: boolean) {
    setExpanded(next);
    if (!window.matchMedia(compactViewport).matches) {
      try {
        localStorage.setItem(sidebarPreference, String(!next));
      } catch {
        // The current page still responds if browser storage is unavailable.
      }
    }
  }

  function collapseNavigation() {
    changeExpansion(false);
    toggle.current?.focus();
  }

  return (
    <>
      {expanded && <div className="sidebar-backdrop" aria-hidden="true" onClick={collapseNavigation} />}
      <header
        className="site-sidebar"
        data-expanded={expanded}
        onKeyDown={(event) => {
          if (expanded && event.key === 'Escape') {
            event.preventDefault();
            collapseNavigation();
          }
        }}
        onBlur={(event) => {
          if (expanded && window.matchMedia(compactViewport).matches
            && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
            setExpanded(false);
          }
        }}
      >
        <div className="sidebar-top">
          <a className="wordmark" href="/" aria-label="ThesisWatch home" title={expanded ? undefined : 'ThesisWatch home'}>
            <span className="wordmark-icon"><BookOpen size={19} strokeWidth={2.3} aria-hidden="true" /></span>
            <span className="sidebar-label">Thesis<span className="wordmark-accent">Watch</span></span>
          </a>
          <button
            ref={toggle}
            className="button button-icon sidebar-toggle"
            type="button"
            aria-label={toggleLabel}
            aria-expanded={expanded}
            aria-controls="sidebar-navigation"
            title={toggleLabel}
            onClick={() => changeExpansion(!expanded)}
          >
            {expanded ? <PanelLeftClose size={19} aria-hidden="true" /> : <PanelLeftOpen size={19} aria-hidden="true" />}
          </button>
        </div>
        <div id="sidebar-navigation" className="sidebar-navigation">
          <nav className="sidebar-pages" aria-label="Pages">
            <NavigationLink href="/" label="Home" icon={House} current={route === '/'} expanded={expanded} />
            {user && <NavigationLink href="/workspace/" label="My workspace" icon={LayoutDashboard}
              current={route === '/workspace'} expanded={expanded} />}
          </nav>
          {showAccount && (
            <nav className="sidebar-account" aria-label="Account">
              {user ? (
                <button className="button sidebar-link" type="button" onClick={onSignOut} disabled={signingOut}
                  title={expanded ? undefined : signOutLabel}>
                  <LogOut size={18} aria-hidden="true" />
                  <span className="sidebar-label">{signOutLabel}</span>
                </button>
              ) : (
                <>
                  <NavigationLink href="/sign-in/" label="Sign in" icon={LogIn} current={route === '/sign-in'} expanded={expanded} />
                  <NavigationLink href="/sign-up/" label="Sign up" icon={UserPlus} current={route === '/sign-up'} expanded={expanded} accent />
                </>
              )}
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
