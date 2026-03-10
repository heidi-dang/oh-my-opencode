import type { PluginInput } from "@opencode-ai/plugin";
import { normalizeSDKResponse } from "./normalize-sdk-response"
import { TokenUsageRegistry } from "./token-usage-registry"

const DEFAULT_ANTHROPIC_ACTUAL_LIMIT = 200_000;
const CHARS_PER_TOKEN_ESTIMATE = 3;
const DEFAULT_TARGET_MAX_TOKENS = 50_000;

type ModelCacheStateLike = {
	anthropicContext1MEnabled: boolean;
}

function getAnthropicActualLimit(modelCacheState?: ModelCacheStateLike): number {
	return (modelCacheState?.anthropicContext1MEnabled ?? false) ||
		process.env.ANTHROPIC_1M_CONTEXT === "true" ||
		process.env.VERTEX_ANTHROPIC_1M_CONTEXT === "true"
		? 1_000_000
		: DEFAULT_ANTHROPIC_ACTUAL_LIMIT;
}

interface AssistantMessageInfo {
	role: "assistant";
	tokens: {
		input: number;
		output: number;
		reasoning: number;
		cache: { read: number; write: number };
	};
}

interface MessageWrapper {
	info: { role: string } & Partial<AssistantMessageInfo>;
}

export interface TruncationResult {
	result: string;
	truncated: boolean;
	removedCount?: number;
}

export interface TruncationOptions {
	targetMaxTokens?: number;
	preserveHeaderLines?: number;
	contextWindowLimit?: number;
}

function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

interface ContentBlock {
	type: "code" | "prose"
	content: string
	tokens: number
}

function extractContentBlocks(text: string): ContentBlock[] {
	const blocks: ContentBlock[] = []
	const lines = text.split("\n")
	let inCodeBlock = false
	let currentBlock: string[] = []
	let currentType: "code" | "prose" = "prose"

	for (const line of lines) {
		if (line.trimStart().startsWith("```")) {
			if (inCodeBlock) {
				// End of code block
				currentBlock.push(line)
				blocks.push({
					type: "code",
					content: currentBlock.join("\n"),
					tokens: estimateTokens(currentBlock.join("\n")),
				})
				currentBlock = []
				currentType = "prose"
				inCodeBlock = false
			} else {
				// Start of code block — flush any prose
				if (currentBlock.length > 0) {
					blocks.push({
						type: "prose",
						content: currentBlock.join("\n"),
						tokens: estimateTokens(currentBlock.join("\n")),
					})
				}
				currentBlock = [line]
				currentType = "code"
				inCodeBlock = true
			}
		} else {
			currentBlock.push(line)
		}
	}

	// Flush remaining
	if (currentBlock.length > 0) {
		blocks.push({
			type: currentType,
			content: currentBlock.join("\n"),
			tokens: estimateTokens(currentBlock.join("\n")),
		})
	}

	return blocks
}

export function truncateToTokenLimit(
	output: string,
	maxTokens: number,
	preserveHeaderLines = 3,
): TruncationResult {
	if (typeof output !== 'string') {
		return { result: String(output ?? ''), truncated: false };
	}

	const currentTokens = estimateTokens(output);

	if (currentTokens <= maxTokens) {
		return { result: output, truncated: false };
	}

	// Lossless compaction: preserve code blocks, truncate prose first
	const blocks = extractContentBlocks(output)
	const codeBlocks = blocks.filter((b) => b.type === "code")
	const proseBlocks = blocks.filter((b) => b.type === "prose")

	const totalCodeTokens = codeBlocks.reduce((sum, b) => sum + b.tokens, 0)
	const truncationMessageTokens = 50

	// If code blocks alone fit, preserve all code and truncate prose
	if (totalCodeTokens + truncationMessageTokens < maxTokens) {
		const availableForProse = maxTokens - totalCodeTokens - truncationMessageTokens
		let proseTokensUsed = 0
		const resultParts: string[] = []
		let truncatedProseLines = 0
		let totalProseLines = 0

		for (const block of blocks) {
			if (block.type === "code") {
				resultParts.push(block.content)
			} else {
				totalProseLines += block.content.split("\n").length
				if (proseTokensUsed + block.tokens <= availableForProse) {
					resultParts.push(block.content)
					proseTokensUsed += block.tokens
				} else {
					// Partial prose truncation
					const remainingTokens = availableForProse - proseTokensUsed
					if (remainingTokens > 0) {
						const lines = block.content.split("\n")
						const partialLines: string[] = []
						let partialTokens = 0
						for (const line of lines) {
							const lineTokens = estimateTokens(line + "\n")
							if (partialTokens + lineTokens > remainingTokens) break
							partialLines.push(line)
							partialTokens += lineTokens
						}
						if (partialLines.length > 0) {
							resultParts.push(partialLines.join("\n"))
						}
						truncatedProseLines += lines.length - partialLines.length
						proseTokensUsed += partialTokens
					} else {
						truncatedProseLines += block.content.split("\n").length
					}
				}
			}
		}

		const result = resultParts.join("\n")
		if (truncatedProseLines > 0) {
			return {
				result: result + `\n\n[${truncatedProseLines} prose lines truncated — ${codeBlocks.length} code blocks preserved intact]`,
				truncated: true,
				removedCount: truncatedProseLines,
			}
		}
		return { result, truncated: false }
	}

	// Fallback: code blocks too large, do standard line-based truncation
	const lines = output.split("\n");

	if (lines.length <= preserveHeaderLines) {
		const maxChars = maxTokens * CHARS_PER_TOKEN_ESTIMATE;
		return {
			result:
				output.slice(0, maxChars) +
				"\n\n[Output truncated due to context window limit]",
			truncated: true,
		};
	}

	const headerLines = lines.slice(0, preserveHeaderLines);
	const contentLines = lines.slice(preserveHeaderLines);

	const headerText = headerLines.join("\n");
	const headerTokens = estimateTokens(headerText);
	const availableTokens = maxTokens - headerTokens - truncationMessageTokens;

	if (availableTokens <= 0) {
		return {
			result:
				headerText + "\n\n[Content truncated due to context window limit]",
			truncated: true,
			removedCount: contentLines.length,
		};
	}

	const resultLines: string[] = [];
	let currentTokenCount = 0;

	for (const line of contentLines) {
		const lineTokens = estimateTokens(line + "\n");
		if (currentTokenCount + lineTokens > availableTokens) {
			break;
		}
		resultLines.push(line);
		currentTokenCount += lineTokens;
	}

	const truncatedContent = [...headerLines, ...resultLines].join("\n");
	const removedCount = contentLines.length - resultLines.length;

	return {
		result:
			truncatedContent +
			`\n\n[${removedCount} more lines truncated due to context window limit]`,
		truncated: true,
		removedCount,
	};
}

export async function getContextWindowUsage(
	ctx: PluginInput,
	sessionID: string,
	modelCacheState?: ModelCacheStateLike,
): Promise<{
	usedTokens: number;
	remainingTokens: number;
	usagePercentage: number;
} | null> {
	try {
		const anthropicActualLimit = getAnthropicActualLimit(modelCacheState);

		// --- LOCAL CACHE CHECK ---
		const cached = TokenUsageRegistry.get(sessionID)

		if (cached && (Date.now() - cached.lastUpdated < 60000)) { // 1 min cache
			const usedTokens = cached.inputTokens + (cached.cacheReadInputTokens ?? 0) + cached.outputTokens
			return {
				usedTokens,
				remainingTokens: anthropicActualLimit - usedTokens,
				usagePercentage: usedTokens / anthropicActualLimit
			}
		}
		// -------------------------

		const response = await ctx.client.session.messages({
			path: { id: sessionID },
		});

		const messages = normalizeSDKResponse(response, [] as MessageWrapper[], { preferResponseOnMissingData: true })

		const assistantMessages = messages
			.filter((m) => m.info.role === "assistant")
			.map((m) => m.info as AssistantMessageInfo);

		if (assistantMessages.length === 0) return null;

		const lastAssistant = assistantMessages[assistantMessages.length - 1];
		const lastTokens = lastAssistant.tokens;
		const usedTokens =
			(lastTokens?.input ?? 0) +
			(lastTokens?.cache?.read ?? 0) +
			(lastTokens?.output ?? 0);
		const remainingTokens = anthropicActualLimit - usedTokens;

		return {
			usedTokens,
			remainingTokens,
			usagePercentage: usedTokens / anthropicActualLimit,
		};
	} catch {
		return null;
	}
}

export async function dynamicTruncate(
	ctx: PluginInput,
	sessionID: string,
	output: string,
	options: TruncationOptions = {},
	modelCacheState?: ModelCacheStateLike,
): Promise<TruncationResult> {
	if (typeof output !== 'string') {
		return { result: String(output ?? ''), truncated: false };
	}

	const {
		targetMaxTokens = DEFAULT_TARGET_MAX_TOKENS,
		preserveHeaderLines = 3,
	} = options;

	const usage = await getContextWindowUsage(ctx, sessionID, modelCacheState);

	if (!usage) {
		// Fallback: apply conservative truncation when context usage unavailable
		return truncateToTokenLimit(output, targetMaxTokens, preserveHeaderLines);
	}

	const maxOutputTokens = Math.min(
		usage.remainingTokens * 0.5,
		targetMaxTokens,
	);

	if (maxOutputTokens <= 0) {
		return {
			result: "[Output suppressed - context window exhausted]",
			truncated: true,
		};
	}

	return truncateToTokenLimit(output, maxOutputTokens, preserveHeaderLines);
}

export function createDynamicTruncator(
	ctx: PluginInput,
	modelCacheState?: ModelCacheStateLike,
) {
	return {
		truncate: (
			sessionID: string,
			output: string,
			options?: TruncationOptions,
		) => dynamicTruncate(ctx, sessionID, output, options, modelCacheState),

		getUsage: (sessionID: string) =>
			getContextWindowUsage(ctx, sessionID, modelCacheState),

		truncateSync: (
			output: string,
			maxTokens: number,
			preserveHeaderLines?: number,
		) => truncateToTokenLimit(output, maxTokens, preserveHeaderLines),
	};
}
