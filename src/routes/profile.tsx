import { useEffect, useState, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AuthDialog } from "@/components/auth-dialog";
import { ShopLookShell } from "@/components/shoplook-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ensureMyProfile, listMyLooks, updateMyProfile } from "@/lib/community.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({ head: () => ({ meta: [{ title: "Your profile — ShopLook" }, { name: "description", content: "Manage your ShopLook profile and published style story." }, { property: "og:title", content: "Your profile — ShopLook" }, { property: "og:description", content: "Manage your ShopLook profile and published style story." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: ProfilePage });

function ProfilePage() {
  const ensure = useServerFn(ensureMyProfile); const list = useServerFn(listMyLooks); const persistProfile = useServerFn(updateMyProfile);
  const [profile, setProfile] = useState<{ handle: string; display_name: string; first_name: string; surname: string; bio: string; style_preferences: string[] } | null>(null);
  const [publicCount, setPublicCount] = useState(0); const [authOpen, setAuthOpen] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await supabase.auth.getSession(); if (!data.session) { setAuthOpen(true); return; } try { const [person, looks] = await Promise.all([ensure(), list()]); setProfile(person); setPublicCount(looks.filter((look) => look.isPublished).length); } catch (error) { setMessage(error instanceof Error ? error.message : "Profile unavailable."); } };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    if (!profile) return;
    const firstName = profile.first_name.trim();
    const surname = profile.surname.trim();
    if (!firstName || !surname) { setMessage("Enter your first name and surname."); return; }
    setBusy(true);
    try {
      const saved = await persistProfile({ data: { firstName, surname, handle: profile.handle, bio: profile.bio } });
      setProfile({ ...profile, ...saved });
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const avatar = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; const user = (await supabase.auth.getUser()).data.user; if (!file || !user) return; if (!file.type.startsWith("image/") || file.size > 4_000_000) { setMessage("Choose an image smaller than 4 MB."); return; } const path = `${user.id}/avatar/${crypto.randomUUID()}.jpg`; const { error } = await supabase.storage.from("shoplook-media").upload(path, file, { contentType: file.type }); if (error) { setMessage(error.message); return; } const updated = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id); setMessage(updated.error?.message ?? "Photo updated."); };
  return <ShopLookShell><section className="px-5 pb-12 pt-7"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Your corner</p><h1 className="mt-2 font-display text-4xl">Profile</h1>{profile ? <><div className="mt-7 border-y border-border py-5"><p className="text-sm font-semibold">{profile.display_name}</p><p className="mt-1 text-sm text-muted-foreground">@{profile.handle}</p><p className="mt-1 text-xs text-muted-foreground">{publicCount} published looks</p><Button asChild variant="link" className="mt-2 h-auto p-0"><Link to="/profile/$handle" params={{ handle: profile.handle }}>View public profile</Link></Button></div><div className="mt-6 space-y-4"><label className="block text-sm font-medium">Handle<Input className="mt-2" value={profile.handle} maxLength={24} onChange={(event) => setProfile({ ...profile, handle: event.target.value })} /></label><label className="block text-sm font-medium">First name<Input className="mt-2" autoComplete="given-name" value={profile.first_name} maxLength={30} onChange={(event) => setProfile({ ...profile, first_name: event.target.value })} /></label><label className="block text-sm font-medium">Surname<Input className="mt-2" autoComplete="family-name" value={profile.surname} maxLength={30} onChange={(event) => setProfile({ ...profile, surname: event.target.value })} /></label><label className="block text-sm font-medium">Bio<Textarea className="mt-2" value={profile.bio} maxLength={240} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label><label className="block text-sm font-medium">Profile photo<input type="file" accept="image/*" onChange={avatar} className="mt-2 block w-full text-xs" /></label><Button className="h-11 w-full" disabled={busy} onClick={save}>Update profile</Button><Button variant="outline" className="h-11 w-full" onClick={async () => { await supabase.auth.signOut(); setProfile(null); setAuthOpen(true); }}>Sign out</Button></div></> : <p className="mt-8 text-sm text-muted-foreground">Sign in to set up your profile.</p>}{message && <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>}</section><AuthDialog open={authOpen} onOpenChange={setAuthOpen} onSignedIn={() => void load()} /></ShopLookShell>;
}