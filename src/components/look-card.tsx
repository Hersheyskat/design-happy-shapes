import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SavedLookDto } from "@/lib/community.types";

export function LookCard({ look }: { look: SavedLookDto }) {
  return (
    <article className="border-b border-border pb-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
        <Link to="/profile/$handle" params={{ handle: look.handle }} className="min-w-0"><p className="truncate text-sm font-semibold">{look.displayName}</p><p className="truncate text-xs text-muted-foreground">@{look.handle} · {look.mood}</p></Link>
        <span className="text-[10px] uppercase text-muted-foreground">{new Date(look.createdAt).toLocaleDateString()}</span>
      </div>
      <Link to="/look/$lookId" params={{ lookId: look.id }} className="block aspect-[4/5] overflow-hidden bg-surface"><img src={look.shopperImageUrl} alt={`${look.displayName}'s ${look.mood} look`} className="size-full object-cover" /></Link>
      <div className="px-5 pt-4"><h2 className="font-display text-2xl">{look.advice.headline}</h2><p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{look.advice.summary}</p>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Heart className="size-4" />{look.likeCount}</span><span className="flex items-center gap-1"><MessageCircle className="size-4" />{look.commentCount}</span><Button asChild variant="ghost" size="sm" className="ml-auto h-9"><Link to="/look/$lookId" params={{ lookId: look.id }}><ShoppingBag /> View look</Link></Button></div>
      </div>
    </article>
  );
}