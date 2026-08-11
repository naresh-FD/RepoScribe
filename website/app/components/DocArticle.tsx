import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock3, Info } from "lucide-react";
import { docPages, type DocPage } from "../docs-data";
import { CodeBlock } from "./CodeBlock";
import { DocsShell } from "./DocsShell";

export function DocArticle({ page }: { page: DocPage }) {
  const pageIndex = docPages.findIndex((item) => item.slug === page.slug);
  const previous = pageIndex > 0 ? docPages[pageIndex - 1] : undefined;
  const next = pageIndex < docPages.length - 1 ? docPages[pageIndex + 1] : undefined;

  return (
    <DocsShell activeSlug={page.slug}>
      <div className="article-layout">
        <article className="doc-article">
          <div className="breadcrumbs">
            <Link href="/">Docs</Link>
            <span>/</span>
            <span>{page.category}</span>
          </div>

          <header className="article-header">
            <span className="article-category">{page.category}</span>
            <h1>{page.title}</h1>
            <p>{page.summary}</p>
            <div className="read-time">
              <Clock3 size={15} aria-hidden="true" /> {page.readTime}
            </div>
          </header>

          <div className="article-body">
            {page.sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2>
                  <a href={`#${section.id}`}>{section.title}</a>
                </h2>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {section.bullets && (
                  <ul className="check-list">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>
                        <Check size={16} aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.steps && (
                  <ol className="steps-list">
                    {section.steps.map((step, index) => (
                      <li key={step.title}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <strong>{step.title}</strong>
                          <p>{step.text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {section.table && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {section.table.headers.map((header) => (
                            <th key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row) => (
                          <tr key={row.join("-")}>
                            {row.map((cell, index) => (
                              <td key={`${cell}-${index}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {section.code && <CodeBlock {...section.code} />}

                {section.note && (
                  <aside className={`doc-note ${section.note.tone === "cool" ? "cool" : ""}`}>
                    <Info size={18} aria-hidden="true" />
                    <div>
                      <strong>{section.note.label}</strong>
                      <p>{section.note.text}</p>
                    </div>
                  </aside>
                )}
              </section>
            ))}
          </div>

          <nav className="article-pagination" aria-label="Documentation pages">
            {previous ? (
              <Link href={`/docs/${previous.slug}`}>
                <ArrowLeft size={17} aria-hidden="true" />
                <span>
                  <small>Previous</small>
                  <strong>{previous.title}</strong>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/docs/${next.slug}`} className="next-link">
                <span>
                  <small>Next</small>
                  <strong>{next.title}</strong>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            )}
          </nav>
        </article>

        <aside className="toc" aria-label="On this page">
          <p>On this page</p>
          {page.sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </aside>
      </div>
    </DocsShell>
  );
}
