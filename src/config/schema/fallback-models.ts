import { z } from "zod"

export const FallbackEntrySchema = z.object({
  providers: z.array(z.string()).optional(),
  model: z.string(),
  variant: z.string().optional(),
})

export const FallbackModelsSchema = z.union([
  z.string(),
  z.array(z.union([z.string(), FallbackEntrySchema])),
])

export type FallbackEntry = z.infer<typeof FallbackEntrySchema>
export type FallbackModels = z.infer<typeof FallbackModelsSchema>
