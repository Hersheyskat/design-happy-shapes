import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createStylistComment } from "./stylist-comment.server.ts";

const lookImage = z
  .string()
  .max(15_000_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);

const stylistCommentInput = z.object({
  lookImage,
  productName: z.string().trim().min(1).max(300),
  retailer: z.string().trim().min(1).max(120),
});

export const analyseGeneratedLook = createServerFn({ method: "POST" })
  .validator((data) => stylistCommentInput.parse(data))
  .handler(async ({ data }) => createStylistComment(data));