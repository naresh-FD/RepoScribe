"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Command,
  Menu,
  Search,
  X,
} from "lucide-react";
import { docPages, navGroups } from "../docs-data";

export function DocsShell({
  children,
  activeSlug,
}: {
  children: React.ReactNode;
  activeSlug?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return docPages;
    return docPages.filter((page) =>
      `${page.title} ${page.summary} ${page.category}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <div className="site-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="RepoScribe docs home">
            <span className="brand-mark" aria-hidden="true">
              R<span>/</span>
            </span>
            <span className="brand-name">RepoScribe</span>
            <span className="brand-divider" />
            <span className="brand-docs">Docs</span>
          </Link>

          <nav className="topbar-actions" aria-label="Utility navigation">
            <span className="version-pill">v1.1.0</span>
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Search documentation"
            >
              <Search size={16} aria-hidden="true" />
              <span>Search docs</span>
              <kbd>
                <Command size={11} aria-hidden="true" />K
              </kbd>
            </button>
            <Link href="/docs/getting-started" className="header-cta">
              Get started <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <button
              className="mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open documentation menu"
              aria-expanded={mobileOpen}
            >
              <Menu size={21} aria-hidden="true" />
            </button>
          </nav>
        </div>
      </header>

      <div className="docs-layout">
        <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-mobile-head">
            <span>Documentation</span>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <Link href="/" className={`sidebar-overview ${!activeSlug ? "active" : ""}`}>
            <BookOpenText size={17} aria-hidden="true" />
            Overview
          </Link>

          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <p>{group.title}</p>
              {group.items.map((item) => (
                <Link
                  key={item.slug}
                  href={`/docs/${item.slug}`}
                  className={activeSlug === item.slug ? "active" : ""}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          ))}

          <div className="sidebar-card">
            <span className="sidebar-card-kicker">THREE OUTPUTS</span>
            <strong>Markdown + HTML + PDF</strong>
            <p>Reviewable in the repo, searchable on the web, and portable offline.</p>
          </div>
        </aside>

        {mobileOpen && (
          <button
            className="sidebar-scrim"
            onClick={() => setMobileOpen(false)}
            aria-label="Close documentation menu"
          />
        )}

        <main className="main-content">{children}</main>
      </div>

      {searchOpen && (
        <div className="search-backdrop">
          <button
            type="button"
            className="search-backdrop-dismiss"
            aria-label="Close search"
            onClick={closeSearch}
          />
          <div
            className="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search RepoScribe documentation"
          >
            <div className="search-input-row">
              <Search size={19} aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search guides, concepts, and commands…"
                aria-label="Search documentation"
              />
              <button onClick={closeSearch} aria-label="Close search">
                ESC
              </button>
            </div>
            <div className="search-results">
              <p className="search-label">{results.length ? "Documentation" : "No results"}</p>
              {results.map((page) => (
                <Link key={page.slug} href={`/docs/${page.slug}`} onClick={closeSearch}>
                  <span>
                    <strong>{page.title}</strong>
                    <small>{page.summary}</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ))}
              {!results.length && (
                <div className="empty-search">Try “configuration”, “CI”, or “parser”.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
