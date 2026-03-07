export function normalizeModel(model?: string): string | undefined {
	const trimmed = model?.trim()
	return trimmed || undefined
}

export function normalizeModelID(modelID: string): string {
  // Special case for MiniMax: platform expects PascalCase and preserved dot
  if (modelID.toLowerCase().includes("minimax-m2")) {
    return modelID.replace(/minimax-m2/i, "MiniMax-M2")
  }
  // For other models, normalize 3.5 -> 3-5 etc.
  return modelID.replace(/\.(\d+)/g, "-$1")
}
