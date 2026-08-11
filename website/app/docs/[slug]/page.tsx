import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticle } from "../../components/DocArticle";
import { docPages, getDocPage } from "../../docs-data";

export function generateStaticParams() {
  return docPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) return {};
  return {
    title: `${page.title} · RepoScribe Docs`,
    description: page.summary,
  };
}

export default async function DocumentationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) notFound();

  return <DocArticle page={page} />;
}
