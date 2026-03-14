export function transformModelForProvider(provider: string, model: string): string {
	if (provider === "github-copilot") {
		return model
			.replace("claude-opus-4-6", "claude-opus-4.6")
			.replace("claude-sonnet-4-6", "claude-sonnet-4.6")
			.replace("claude-sonnet-4-5", "claude-sonnet-4.5")
			.replace("claude-haiku-4-5", "claude-haiku-4.5")
			.replace("claude-sonnet-4", "claude-sonnet-4")
			.replace(/gemini-3\.1-pro(?!-)/g, "gemini-3.1-pro-preview")
			.replace(/gemini-3-flash(?!-)/g, "gemini-3-flash-preview")
	}
	if (provider === "google") {
		return model
			.replace(/gemini-3\.1-pro(?!-)/g, "gemini-3.1-pro-preview")
			.replace(/gemini-3-flash(?!-)/g, "gemini-3-flash-preview")
	}
	if (provider === "ollama" || provider === "openai-compatible") {
		// For openai-compatible providers (like Ollama), use the model name as-is
		// Common local model name normalization
		return model
			.replace(/^llama-3\.2/i, "llama3.2")
			.replace(/^qwen-2\.5/i, "qwen2.5")
			.replace(/^deepseek-coder/i, "deepseek-coder")
			.replace(/^code-llama/i, "codellama")
	}
	return model
}
