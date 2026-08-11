"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlock({
  language,
  label,
  value,
}: {
  language: string;
  label?: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <span>{label ?? language}</span>
        <button onClick={copy} aria-label={`Copy ${label ?? language} code`}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code data-language={language}>{value}</code>
      </pre>
    </div>
  );
}
