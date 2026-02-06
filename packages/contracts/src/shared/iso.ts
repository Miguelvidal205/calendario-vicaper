import { z } from "zod";

export const IsoDateTimeString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid ISO datetime");

export const UuidString = z.string().uuid();
