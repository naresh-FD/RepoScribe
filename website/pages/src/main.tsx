import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Home from "../../app/page";
import { DocArticle } from "../../app/components/DocArticle";
import { DocsShell } from "../../app/components/DocsShell";
import { getDocPage } from "../../app/docs-data";
import "../../app/globals.css";

function currentRoute() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathname = window.location.pathname;
  const route = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return route.replace(/^\/+|\/+$/g, "");
}

function StaticApp() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onRouteChange = () => setRoute(currentRoute());
    window.addEventListener("popstate", onRouteChange);
    return () => window.removeEventListener("popstate", onRouteChange);
  }, []);

  const match = route.match(/^docs\/([^/]+)$/);
  const page = match ? getDocPage(decodeURIComponent(match[1])) : undefined;

  useEffect(() => {
    document.title = page
      ? `${page.title} · RepoScribe Docs`
      : route
        ? "Page not found · RepoScribe Docs"
        : "RepoScribe Docs · Turn repositories into readable guides";
  }, [page, route]);

  if (!route) return <Home />;
  if (page) return <DocArticle page={page} />;

  return (
    <DocsShell>
      <div className="not-found">
        <span>404 / MISSING PAGE</span>
        <h1>This page slipped out of the docs.</h1>
        <p>The guide may have moved, or the URL may be incomplete.</p>
        <a href={import.meta.env.BASE_URL}>Back to documentation</a>
      </div>
    </DocsShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StaticApp />
  </React.StrictMode>,
);
