import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { LookCard } from "@/components/look-card";
import { ShopLookShell } from "@/components/shoplook-shell";
import { listDiscoverLooks } from "@/lib/community.functions";

const discoverQuery = queryOptions({ queryKey: ["discover-looks"], queryFn: () => listDiscoverLooks() });

export const Route = createFileRoute("/discover")({
  head: () => ({ meta: [{ title: "Discover looks — ShopLook" }, { name: "description", content: "Discover published looks and reusable products from the ShopLook community." }, { property: "og:title", content: "Discover looks — ShopLook" }, { property: "og:description", content: "Discover published looks and reusable products from the ShopLook community." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(discoverQuery); },
  component: DiscoverPage,
  errorComponent: ({ error }) => <PageMessage title="Discover is unavailable" message={error instanceof Error ? error.message : "Please try again."} />,
  notFoundComponent: () => <PageMessage title="Nothing here yet" message="Published looks will appear here." />,
});

function DiscoverPage() {
  const { data } = useSuspenseQuery(discoverQuery);
  return <ShopLookShell><header className="border-b border-border px-5 pb-5 pt-7"><p className="text-xs font-semibold uppercase tracking-widest text-primary">ShopLook community</p><h1 className="mt-2 font-display text-4xl">Discover</h1><p className="mt-2 text-sm text-muted-foreground">Real looks, useful details, products you can start with.</p></header>{data.length ? <div className="pt-2">{data.map((look) => <LookCard key={look.id} look={look} />)}</div> : <section className="px-6 py-24 text-center"><h2 className="font-display text-3xl">The first looks are coming</h2><p className="mt-3 text-sm text-muted-foreground">Publish a saved look to start the community.</p></section>}</ShopLookShell>;
}

function PageMessage({ title, message }: { title: string; message: string }) { return <ShopLookShell><section className="px-6 py-24 text-center"><h1 className="font-display text-3xl">{title}</h1><p className="mt-3 text-sm text-muted-foreground">{message}</p></section></ShopLookShell>; }