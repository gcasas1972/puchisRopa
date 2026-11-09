import { z } from "zod";

const variantSchema = z.object({
  size: z.string().trim().min(1).max(24),
  stock: z.number().int().min(0).max(100_000),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(2_000),
  category: z.string().trim().min(2).max(60),
  price: z.number().int().min(1).max(100_000_000),
  imageUrl: z.string().url().max(2_000),
  isActive: z.boolean(),
  variants: z.array(variantSchema).min(1).max(30).refine(
    (items) => new Set(items.map((item) => item.size.toLocaleLowerCase("es"))).size === items.length,
    "No puede haber talles repetidos.",
  ),
});

export const orderInputSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().min(6).max(40),
    address: z.string().trim().min(4).max(250),
    notes: z.string().trim().max(1_000).default(""),
  }),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(30)
    .refine((items) => new Set(items.map((item) => item.variantId)).size === items.length),
});

export const orderStatusSchema = z.object({
  status: z.enum(["confirmed", "shipped", "cancelled"]),
});
