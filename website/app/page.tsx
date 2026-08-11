import Link from "next/link";
import {
  ArrowRight,
  Braces,
  Boxes,
  Check,
  FileText,
  GitBranch,
  Layers3,
  ScanSearch,
  Settings2,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { DocsShell } from "./components/DocsShell";

const quickLinks = [
  {
    href: "/docs/getting-started",
    icon: Sparkles,
    label: "Quickstart",
    title: "First docs in five minutes",
    text: "Install, configure, and generate your first developer guide.",
    accent: "coral",
  },
  {
    href: "/docs/configuration",
    icon: Settings2,
    label: "Reference",
    title: "Configure every layer",
    text: "Sources, output formats, validation, ADRs, and changelogs.",
    accent: "mint",
  },
  {
    href: "/docs/architecture",
    icon: GitBranch,
    label: "Architecture",
    title: "Follow the pipeline",
    text: "See how source becomes DocIR, transforms, Markdown, and PDF.",
    accent: "blue",
  },
];

export default function Home() {
  return (
    <DocsShell>
      <div className="home-page">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> REPOSITORY → KNOWLEDGE
            </div>
            <h1>
              Documentation that <em>keeps up</em> with the code.
            </h1>
            <p>
              RepoScribe turns React, TypeScript, and Spring Boot repositories into layered developer
              guides—complete enough for reference, focused enough to read.
            </p>
            <div className="hero-actions">
              <Link href="/docs/getting-started" className="primary-button">
                Start generating <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/docs/architecture" className="secondary-button">
                Explore the architecture
              </Link>
            </div>
            <div className="hero-meta">
              <span><Check size={15} aria-hidden="true" /> React + TypeScript</span>
              <span><Check size={15} aria-hidden="true" /> Java + Spring Boot</span>
              <span><Check size={15} aria-hidden="true" /> Markdown + PDF</span>
            </div>
          </div>

          <div className="hero-terminal" aria-label="RepoScribe generation example">
            <div className="terminal-titlebar">
              <div><i /><i /><i /></div>
              <span>reposcribe / generate</span>
              <TerminalSquare size={15} aria-hidden="true" />
            </div>
            <div className="terminal-body">
              <p><span className="prompt">$</span> reposcribe-cli generate <b>--format</b> markdown pdf</p>
              <div className="terminal-progress">
                <span><Check size={14} /> Parsed 22 source files</span>
                <span><Check size={14} /> Built DocIR graph</span>
                <span><Check size={14} /> Planned developer guide</span>
              </div>
              <div className="terminal-tree">
                <span>docs/</span>
                <span>├── <b>README.md</b></span>
                <span>├── architecture.md</span>
                <span>├── features/</span>
                <span>├── api/services.md</span>
                <span>└── pdf/<em>developer-guide.pdf</em></span>
              </div>
              <div className="terminal-done">
                <Sparkles size={15} aria-hidden="true" /> 12 docs generated in 1.8s
              </div>
            </div>
          </div>
        </section>

        <section className="signal-strip" aria-label="RepoScribe capabilities">
          <div><strong>02</strong><span>language ecosystems</span></div>
          <div><strong>06</strong><span>composable packages</span></div>
          <div><strong>02</strong><span>output formats</span></div>
          <div><strong>01</strong><span>shared DocIR</span></div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="section-kicker">POPULAR PATHS</span>
              <h2>Start where you are.</h2>
            </div>
            <p>From first run to plugin internals, every guide follows the same developer-first path.</p>
          </div>
          <div className="quick-grid">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link href={item.href} className={`quick-card ${item.accent}`} key={item.href}>
                  <div className="quick-card-top">
                    <span className="quick-icon"><Icon size={20} aria-hidden="true" /></span>
                    <span className="quick-label">{item.label}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span className="card-link">Open guide <ArrowRight size={16} aria-hidden="true" /></span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="pipeline-section">
          <div className="pipeline-intro">
            <span className="section-kicker">ONE CLEAN PIPELINE</span>
            <h2>From source tree to shared understanding.</h2>
            <p>
              Language-specific parsing stays at the edge. Everything after that speaks DocIR, so
              planning and output stay consistent across projects.
            </p>
            <Link href="/docs/architecture">Read the architecture guide <ArrowRight size={16} /></Link>
          </div>
          <div className="pipeline-steps">
            <div className="pipeline-line" />
            <div>
              <span className="step-number">01</span>
              <span className="step-icon"><ScanSearch size={21} /></span>
              <h3>Parse</h3>
              <p>Language plugins discover meaningful symbols and framework metadata.</p>
            </div>
            <div>
              <span className="step-number">02</span>
              <span className="step-icon"><Braces size={21} /></span>
              <h3>Structure</h3>
              <p>DocIR normalizes modules, members, types, links, and coverage.</p>
            </div>
            <div>
              <span className="step-number">03</span>
              <span className="step-icon"><FileText size={21} /></span>
              <h3>Publish</h3>
              <p>Renderers produce a navigable Markdown set and one combined PDF.</p>
            </div>
          </div>
        </section>

        <section className="modes-section">
          <div className="modes-copy">
            <span className="section-kicker">THE RIGHT LEVEL OF DETAIL</span>
            <h2>Readable by default.<br />Exhaustive on demand.</h2>
            <p>
              Developer mode organizes the project around the questions engineers actually ask.
              Exhaustive mode is there when every symbol matters.
            </p>
            <Link href="/docs/generating-docs" className="text-link">
              Compare generation modes <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mode-cards">
            <div className="mode-card featured">
              <span className="mode-badge">DEFAULT</span>
              <Layers3 size={24} aria-hidden="true" />
              <h3>Developer mode</h3>
              <p>Architecture, setup, features, services, components, state, testing, and troubleshooting.</p>
              <code>--mode developer</code>
            </div>
            <div className="mode-card">
              <span className="mode-badge">DEEP DIVE</span>
              <Boxes size={24} aria-hidden="true" />
              <h3>Exhaustive mode</h3>
              <p>Module-by-module and symbol-by-symbol output for audits, migrations, and API inspection.</p>
              <code>--mode exhaustive</code>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div>
            <span className="section-kicker">MAKE THE REPO EXPLAIN ITSELF</span>
            <h2>Your first guide is one config file away.</h2>
          </div>
          <Link href="/docs/getting-started" className="primary-button light">
            Read the quickstart <ArrowRight size={17} />
          </Link>
        </section>

        <footer className="site-footer">
          <span>RepoScribe <b>R/</b></span>
          <p>Developer documentation for React, TypeScript, Java, and Spring Boot.</p>
          <span>MIT licensed</span>
        </footer>
      </div>
    </DocsShell>
  );
}
