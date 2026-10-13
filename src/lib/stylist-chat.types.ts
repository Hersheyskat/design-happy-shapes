export type StylistLookTrayItem = {
  kind: "session" | "saved";
  savedLookId?: string | undefined;
  sessionImagePath?: string | undefined;
  productName: string;
  comment: string;
  imageUrl: string;
  imagePath: string;
};

export type StylistActiveLook = {
  kind: "session" | "saved";
  savedLookId?: string | undefined;
  sessionImagePath?: string | undefined;
  productName: string;
  comment: string;
  imageUrl: string;
  imagePath: string;
};

export type StylistMessageMetadata = {
  productName?: string;
  comment?: string;
  imagePath?: string;
  savedLookId?: string;
};
