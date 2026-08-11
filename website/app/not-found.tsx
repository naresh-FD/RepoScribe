import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DocsShell } from "./components/DocsShell";

export default function NotFound() {
  return (
    <DocsShell>
      <div className="not-found">
        <span>404 / MISSING PAGE</span>
        <h1>This page slipped out of the docs.</h1>
        <p>The guide may have moved, or the URL may be incomplete.</p>
        <Link href="/">
          <ArrowLeft size={17} /> Back to documentation
        </Link>
      </div>
    </DocsShell>
  );
}
