import { Link } from "@tanstack/react-router";
import { MessageCircle, Heart, Home, UserRound, Shirt } from "lucide-react";
import type { ReactNode } from "react";

export function ShopLookShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] border-x border-border/70 bg-background pb-20 shadow-page">
        {children}
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto grid h-16 max-w-[430px] grid-cols-5 border-x border-t border-border bg-background/95 backdrop-blur"
        aria-label="ShopLook navigation"
      >
        <NavItem to="/" label="Look" icon={<Home />} />
        <NavItem to="/wardrobe" label="Wardrobe" icon={<Shirt />} />
        <NavItem to="/chat" label="Chat" icon={<MessageCircle />} />
        <NavItem to="/saved" label="Saved" icon={<Heart />} />
        <NavItem to="/profile" label="Profile" icon={<UserRound />} />
      </nav>
    </main>
  );
}

function NavItem({
  to,
  label,
  icon,
}: {
  to: "/" | "/wardrobe" | "/chat" | "/saved" | "/profile";
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground [&_svg]:size-5"
      activeProps={{ className: "text-primary" }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
