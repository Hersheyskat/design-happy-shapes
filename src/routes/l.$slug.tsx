import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LoaderCircle, ShoppingBag, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { ShopLookShell } from "@/components/shoplook-shell";
import { Button } from "@/components/ui/button";
import { getSharedLook } from "@/lib/community.functions";
import { recordShopperEvent } from "@/lib/shopper-events.functions";

function productBrand(name: string) {
  const brands = [
    "Symbol Premium",
    "SMOWKLY",
    "DEELMO",
    "INKAST",
    "AD by Arvind",
    "BASICS",
    "Thomas Scott",
    "FableStreet",
    "SaintX",
    "Cottinfab",
    "U.S. Polo ASSN.",
    "ROCKSY",
    "KLOSIA",
    "Stylum",
    "Myx",
    "Calvin Klein",
    "CK",
    "Louis Philippe",
    "USPA",
    "Levi's",
    "SHEIN",
    "Moomaya",
  ];
  const withoutRetailerPrefix = name.replace(/^Amazon Brand\s*[-–]\s*/i, "");
  return (
    brands.find((brand) => withoutRetailerPrefix.toLowerCase().startsWith(brand.toLowerCase())) ??
    "Brand not listed"
  );
}

export const Route = createFileRoute("/l/$slug")({
  head: () => ({
    meta: [
      { title: "Shared ShopLook" },
      { name: "description", content: "View a shared ShopLook and shop the featured piece." },
      { property: "og:title", content: "Shared ShopLook" },
      {
        property: "og:description",
        content: "View a shared ShopLook and shop the featured piece.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    try {
      return await getSharedLook({ data: { slug: params.slug } });
    } catch {
      throw notFound();
    }
  },
  component: SharedLookPage,
  notFoundComponent: () => (
    <ShopLookShell>
      <section className="px-6 py-24 text-center">
        <h1 className="font-display text-3xl">Look unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This shared look may have been removed.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Create your ShopLook</Link>
        </Button>
      </section>
    </ShopLookShell>
  ),
  errorComponent: ({ error }) => (
    <ShopLookShell>
      <p role="alert" className="p-8">
        {error instanceof Error ? error.message : "This look could not load."}
      </p>
    </ShopLookShell>
  ),
});

function SharedLookPage() {
  const look = Route.useLoaderData();
  const trackEvent = useServerFn(recordShopperEvent);
  const [shopOpen, setShopOpen] = useState(false);
  const brand = productBrand(look.productName ?? look.advice.headline);
  const price =
    look.productPrice != null ? `₹${Number(look.productPrice).toLocaleString("en-IN")}` : null;

  function continueToShop() {
    if (!look.productUrl) return;
    void trackEvent({
      data: {
        eventType: "buy_click",
        catalogProductId: look.catalogProductId,
        savedLookId: look.id,
        channel: "shared_look",
        metadata: {
          product_name: look.productName,
          retailer: look.productRetailer,
          price: look.productPrice,
          currency: look.productCurrency,
          product_url: look.productUrl,
          share_slug: look.shareSlug,
        },
      },
    }).catch(() => {});
    setShopOpen(false);
    window.open(look.productUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <ShopLookShell>
      <header className="flex h-16 items-center border-b border-border px-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/" aria-label="Back to ShopLook">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="ml-2 font-display text-2xl">ShopLook</span>
      </header>
      <section className="pb-12">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface">
          {look.shopperImageUrl ? (
            <img
              src={look.shopperImageUrl}
              alt={look.productName ?? look.advice.headline}
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <LoaderCircle className="animate-spin text-primary" />
            </div>
          )}
          <span className="absolute bottom-3 left-3 rounded bg-overlay px-2.5 py-1 text-[10px] font-semibold text-overlay-foreground">
            ShopLook.ai
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl">{brand}</h1>
            <p className="text-sm text-muted-foreground">
              {[look.productRetailer, price].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 px-5">
          {look.catalogProductId ? (
            <Button
              asChild
              variant="outline"
              className="h-11 px-2 text-center text-xs leading-tight sm:text-sm"
            >
              <Link to="/" search={{ product: look.catalogProductId }}>
                Try on you
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              className="h-11 px-2 text-center text-xs leading-tight sm:text-sm"
            >
              <Link to="/">Try on you</Link>
            </Button>
          )}
          <Button
            className="h-11 px-2"
            disabled={!look.productUrl}
            onClick={() => setShopOpen(true)}
          >
            <ShoppingBag /> {look.productUrl ? "Buy" : "Unavailable"}
          </Button>
        </div>
        <div className="mx-5 mt-4 border-y border-border py-4">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-4" />
            <h2 className="text-sm font-semibold">Stylist's take</h2>
          </div>
          <p className="mt-2 text-sm leading-6">{look.advice.summary}</p>
        </div>
      </section>

      {shopOpen && look.productUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thank you for using ShopLook"
          className="fixed inset-0 z-50 flex items-end justify-center bg-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShopOpen(false);
          }}
        >
          <div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Thank you</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setShopOpen(false)}
              >
                <X />
              </Button>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Thank you for using ShopLook. We&apos;ll take you to the retailer to continue
              shopping.
            </p>
            <Button className="mt-5 h-12 w-full" onClick={continueToShop}>
              <ShoppingBag /> Continue to {look.productRetailer ?? "retailer"}
            </Button>
            <Button
              variant="outline"
              className="mt-2 h-11 w-full"
              onClick={() => setShopOpen(false)}
            >
              Stay on ShopLook
            </Button>
          </div>
        </div>
      )}
    </ShopLookShell>
  );
}
