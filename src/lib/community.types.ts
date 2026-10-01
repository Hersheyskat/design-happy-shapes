import type { StyleAdvice } from "./style-advice.types";

export const styleMoods = ["minimal", "street", "classic", "romantic", "sporty"] as const;
export type StyleMood = (typeof styleMoods)[number];

export type SavedLookDto = {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  shopperImageUrl: string;
  productImageUrl: string | null;
  productUrl: string | null;
  mood: StyleMood;
  advice: StyleAdvice;
  isPublished: boolean;
  createdAt: string;
  items: Array<{ id: string; label: string; searchTerm: string; destinationUrl: string; source: "submitted" | "suggested" }>;
  likeCount: number;
  commentCount: number;
};

export type ProfileDto = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  stylePreferences: string[];
  publicLookCount: number;
  followerCount: number;
  followingCount: number;
};