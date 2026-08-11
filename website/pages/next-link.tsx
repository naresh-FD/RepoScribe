import React, { forwardRef } from "react";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

function pagesHref(href: string) {
  if (href.startsWith("#") || /^(https?:|mailto:|tel:)/.test(href)) return href;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${href.startsWith("/") ? href : `/${href}`}`;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, onClick, target, ...props },
  ref,
) {
  const resolvedHref = pagesHref(href);

  return (
    <a
      {...props}
      ref={ref}
      href={resolvedHref}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          target === "_blank" ||
          /^(https?:|mailto:|tel:|#)/.test(href)
        ) {
          return;
        }

        event.preventDefault();
        window.history.pushState({}, "", resolvedHref);
        window.dispatchEvent(new PopStateEvent("popstate"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );
});

export default Link;
