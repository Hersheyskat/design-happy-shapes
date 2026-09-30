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
  catalogProductId: string | null;
  productName: string | null;
  productRetailer: string | null;
  productPrice: number | null;
  productCurrency: string | null;
  styleNote: string;
  mood: StyleMood;
  advice: StyleAdvice;
  isPublished: boolean;
  createdAt: string;
  items: Array<{ id: string; label: string; searchTerm: string; destinationUrl: string; source: "submitted" | "suggested" }>;
  likeCount: number;
  commentCount: number;
};

export type CatalogProductDto = {
  id: string;
  audience: "men" | "women";
  name: string;
  category: string;
  retailer: string;
  price: number;
  currency: string;
  image: string;
  productUrl: string;
  refreshedAt: string;
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