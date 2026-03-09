import { readStreamWithLimit } from "../../shared/stream-limiter"

type SpawnedProcess = {
	stdout: ReadableStream | null
	stderr: ReadableStream | null
	exited: Promise<number>
	kill: () => void
}

export async function collectProcessOutputWithTimeout(
	process: SpawnedProcess,
	timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const timeoutPromise = new Promise<never>((_, reject) => {
		const timeoutId = setTimeout(() => {
			process.kill()
			reject(new Error(`Search timeout after ${timeoutMs}ms`))
		}, timeoutMs)
		process.exited.then(() => clearTimeout(timeoutId))
	})

	const stdoutPromise = readStreamWithLimit(process.stdout, 10 * 1024 * 1024)
	const stderrPromise = readStreamWithLimit(process.stderr, 1 * 1024 * 1024)

	const stdout = await Promise.race([stdoutPromise, timeoutPromise])
	const stderr = await stderrPromise
	const exitCode = await process.exited

	return { stdout, stderr, exitCode }
}
