import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createStyleAdvice } from "./style-advice.server.ts";

const dataImage = z
  .string()
  .max(3_000_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);

const adviceInput = z
  .object({
    shopperImage: dataImage,
    shopperMime: z.enum(["image/jpeg", "image/png", "image/webp"]),
    productImage: dataImage.nullable(),
    productMime: z.enum(["image/jpeg", "image/png", "image/webp"]).nullable(),
    productUrl: z.string().trim().url().max(2048).nullable(),
  })
  .superRefine((value, context) => {
    if (!value.productImage && !value.productUrl) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Add a product screenshot or link." });
    }
    if (value.productUrl && !value.productUrl.startsWith("https://")) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Product links must use HTTPS." });
    }
    if (Boolean(value.productImage) !== Boolean(value.productMime)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Product image details are incomplete." });
    }
  });

export const analyseShopLook = createServerFn({ method: "POST" })
  .inputValidator((data) => adviceInput.parse(data))
  .handler(async ({ data }) => createStyleAdvice(data));