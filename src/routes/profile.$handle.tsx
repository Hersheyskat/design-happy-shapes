import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { AuthDialog } from "@/components/auth-dialog";
import { LookCard } from "@/components/look-card";
import { ShopLookShell } from "@/components/shoplook-shell";
import { Button } from "@/components/ui/button";
import { getPublicProfile, listDiscoverLooks, toggleFollow } from "@/lib/community.functions";
import { supabase } from "@/integrations/supabase/client";

const profileQuery = (handle: string) => queryOptions({ queryKey: ["public-profile", handle], queryFn: () => getPublicProfile({ data: { handle } }) });
const looksQuery = queryOptions({ queryKey: ["discover-looks"], queryFn: () => listDiscoverLooks() });
export const Route = createFileRoute("/profile/$handle")({
  head: ({ params }) => ({ meta: [{ title: `@${params.handle} — ShopLook` }, { name: "description", content: `Explore @${params.handle}'s public looks on ShopLook.` }, { property: "og:title", content: `@${params.handle} — ShopLook` }, { property: "og:description", content: `Explore @${params.handle}'s public looks on ShopLook.` }, { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: async ({ context, params }) => { await Promise.all([context.queryClient.ensureQueryData(profileQuery(params.handle)), context.queryClient.ensureQueryData(looksQuery)]); },
  component: PublicProfilePage,
  errorComponent: ({ error }) => <ShopLookShell><p role="alert" className="p-8 text-sm">{error instanceof Error ? error.message : "This profile could not load."}</p></ShopLookShell>,
  notFoundComponent: () => <ShopLookShell><p className="p-8 text-sm">Profile not found.</p></ShopLookShell>,
});
function PublicProfilePage() { const { handle } = Route.useParams(); const { data: profile } = useSuspenseQuery(profileQuery(handle)); const { data: all } = useSuspenseQuery(looksQuery); const follow = useServerFn(toggleFollow); const [following, setFollowing] = useState(false); const [authOpen, setAuthOpen] = useState(false); const [message, setMessage] = useState(""); const looks = all.filter((look) => look.userId === profile.id); const onFollow = async () => { const user = (await supabase.auth.getUser()).data.user; if (!user) { setAuthOpen(true); return; } try { await follow({ data: { profileId: profile.id, following: !following } }); setFollowing(!following); setMessage(following ? "Unfollowed" : "Following"); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not follow."); } }; return <ShopLookShell><header className="border-b border-border px-5 pb-6 pt-7"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Style profile</p><h1 className="mt-2 font-display text-4xl">{profile.displayName}</h1><p className="mt-1 text-sm text-muted-foreground">@{profile.handle}</p><p className="mt-4 text-sm leading-6">{profile.bio}</p><p className="mt-4 text-xs text-muted-foreground">{profile.publicLookCount} looks · {profile.followerCount} followers · {profile.followingCount} following</p><Button className="mt-5 h-10" onClick={onFollow}>{following ? "Following" : "Follow"}</Button>{message && <p role="status" className="mt-2 text-xs">{message}</p>}</header>{looks.length ? looks.map((look) => <LookCard key={look.id} look={look} />) : <p className="p-8 text-center text-sm text-muted-foreground">No published looks yet.</p>}<AuthDialog open={authOpen} onOpenChange={setAuthOpen} /></ShopLookShell>; }