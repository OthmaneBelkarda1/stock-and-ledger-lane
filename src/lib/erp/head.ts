export const pageHead = (title: string, description: string) => () => ({
  meta: [
    { title: `${title} — Gestion commerciale` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Gestion commerciale` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});
