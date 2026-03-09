
/**
 * Reads a ReadableStream into a string up to a maximum number of characters.
 * Cancels the stream if the limit is exceeded.
 */
export async function readStreamWithLimit(
  stream: ReadableStream | null,
  limitChars: number
): Promise<string> {
  if (!stream) return ""
  const reader = stream.getReader()
  let result = ""
  let totalChars = 0
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      if (totalChars + chunk.length > limitChars) {
        result += chunk.substring(0, limitChars - totalChars)
        break
      }
      result += chunk
      totalChars += chunk.length
    }
  } finally {
    reader.releaseLock()
    try { await stream.cancel() } catch { /* Ignore cancel errors */ }
  }
  return result
}
