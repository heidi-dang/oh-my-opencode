/**
 * Playbook Registry — Ranked repair strategies and decision trees
 * for each diagnostic class.
 *
 * Each playbook defines:
 *   - strategy_priority: ordered from strongest (root-cause) to weakest
 *   - inspection_steps: what to check before applying a fix
 *   - anti_patterns: what to avoid
 *   - decision_tree: condition → strategy mapping
 *   - verification_command: how to confirm the fix worked
 */

import type { RepairPlaybook, DiagnosticClass } from "./types"

const PLAYBOOKS: Map<DiagnosticClass, RepairPlaybook> = new Map()

// ────────────────────────────────────────────
// Python: Optional null attribute access
// ────────────────────────────────────────────

PLAYBOOKS.set("python.optional-null-attribute", {
  class: "python.optional-null-attribute",
  strategy_priority: ["guard-fail-fast", "contract-fix", "assertion", "conditional-access"],
  inspection_steps: [
    "Find where the variable is assigned (trace upstream)",
    "Check the function return type annotation",
    "Check if there is already a guard in the nearby control flow",
    "Determine if the object is required for continued execution or genuinely optional",
    "Check if the loader/factory function should never return None on success path",
  ],
  anti_patterns: [
    "Do NOT blindly add 'if x is not None' everywhere",
    "Do NOT cast to Any or use type: ignore",
    "Do NOT suppress the diagnostic without narrowing",
    "Do NOT add assertions without verifying upstream logic guarantees non-None",
  ],
  decision_tree: [
    {
      condition: "The object is required for the code path to be valid",
      strategy: "guard-fail-fast",
      rationale: "Add explicit guard + raise/return early. The code cannot function without this object.",
    },
    {
      condition: "The upstream function should never return None on the success path",
      strategy: "contract-fix",
      rationale: "Fix the function contract: raise on failure instead of returning None. This is the root-cause fix.",
    },
    {
      condition: "A runtime invariant already guarantees the object is not None",
      strategy: "assertion",
      rationale: "Add an assert to make the invariant explicit to the type checker.",
    },
    {
      condition: "None is a genuinely valid business case",
      strategy: "conditional-access",
      rationale: "Add a conditional branch with explicit fallback behavior.",
    },
  ],
  verification_command: "pyright {file} || mypy {file}",
})

// ────────────────────────────────────────────
// Python: Optional null subscript
// ────────────────────────────────────────────

PLAYBOOKS.set("python.optional-null-subscript", {
  class: "python.optional-null-subscript",
  strategy_priority: ["guard-fail-fast", "contract-fix", "assertion", "conditional-access"],
  inspection_steps: [
    "Find where the subscripted variable is assigned",
    "Check if the variable can legitimately be None at this point",
    "Check upstream function return type",
    "Determine if subscript access is safe after a guard",
  ],
  anti_patterns: [
    "Do NOT suppress with type: ignore",
    "Do NOT wrap in try/except without addressing root cause",
    "Do NOT change the variable type to Any",
  ],
  decision_tree: [
    {
      condition: "The variable must be a container for the code to work",
      strategy: "guard-fail-fast",
      rationale: "Add guard + raise/return. If it's None, subsequent logic is invalid.",
    },
    {
      condition: "The function producing this value should guarantee a container",
      strategy: "contract-fix",
      rationale: "Fix the upstream function contract to raise instead of returning None.",
    },
    {
      condition: "Runtime invariant guarantees non-None",
      strategy: "assertion",
      rationale: "Narrow the type with an explicit assertion.",
    },
    {
      condition: "None is acceptable and should skip the subscript operation",
      strategy: "conditional-access",
      rationale: "Wrap in a conditional with explicit fallback.",
    },
  ],
  verification_command: "pyright {file} || mypy {file}",
})

// ────────────────────────────────────────────
// Python: Possibly unbound
// ────────────────────────────────────────────

PLAYBOOKS.set("python.possibly-unbound", {
  class: "python.possibly-unbound",
  strategy_priority: ["guard-fail-fast", "type-narrowing"],
  inspection_steps: [
    "Check if the variable is defined in all branches of a conditional",
    "Check if there is a missing else/default assignment",
    "Determine if the variable should have a default value",
  ],
  anti_patterns: [
    "Do NOT suppress the warning",
    "Do NOT initialize to None if the variable must be a specific type",
  ],
  decision_tree: [
    {
      condition: "The variable is only assigned in one branch of an if/else",
      strategy: "guard-fail-fast",
      rationale: "Add the missing assignment in the other branch, or raise/return early.",
    },
    {
      condition: "The variable should have a default value",
      strategy: "type-narrowing",
      rationale: "Initialize the variable before the conditional with an appropriate default.",
    },
  ],
  verification_command: "pyright {file} || mypy {file}",
})

// ────────────────────────────────────────────
// Python: Import error
// ────────────────────────────────────────────

PLAYBOOKS.set("python.import-error", {
  class: "python.import-error",
  strategy_priority: ["import-fix"],
  inspection_steps: [
    "Check if the module exists in the project or is an external dependency",
    "Check if it's a typo in the module name",
    "Check if it's a missing __init__.py",
    "Check requirements.txt / pyproject.toml for missing dependency",
  ],
  anti_patterns: [
    "Do NOT silence with try/except ImportError unless genuinely optional",
    "Do NOT add runtime-only imports to bypass type checking",
  ],
  decision_tree: [
    {
      condition: "Module exists but path is wrong",
      strategy: "import-fix",
      rationale: "Correct the import path.",
    },
    {
      condition: "Module is missing from dependencies",
      strategy: "import-fix",
      rationale: "Add the dependency to requirements/pyproject and install it.",
    },
  ],
  verification_command: "pyright {file} || python -c 'import {symbol}'",
})

// ────────────────────────────────────────────
// TypeScript: Possibly undefined
// ────────────────────────────────────────────

PLAYBOOKS.set("typescript.possibly-undefined", {
  class: "typescript.possibly-undefined",
  strategy_priority: ["guard-fail-fast", "type-narrowing", "assertion", "conditional-access"],
  inspection_steps: [
    "Check the variable's type declaration",
    "Trace upstream assignment or function return type",
    "Check if the value comes from an optional property, Map.get, or array access",
    "Determine if undefined is a valid runtime case",
  ],
  anti_patterns: [
    "Do NOT use non-null assertion (!) without verifying the invariant",
    "Do NOT cast to any",
    "Do NOT use @ts-ignore or @ts-expect-error",
  ],
  decision_tree: [
    {
      condition: "The value must exist for the function to work correctly",
      strategy: "guard-fail-fast",
      rationale: "Add explicit check + throw/return early.",
    },
    {
      condition: "The value comes from an optional chain that can be narrowed",
      strategy: "type-narrowing",
      rationale: "Add a type guard or narrowing check.",
    },
    {
      condition: "A runtime invariant guarantees the value exists",
      strategy: "assertion",
      rationale: "Use an assertion or non-null assertion with a comment explaining the invariant.",
    },
    {
      condition: "Undefined is genuinely valid and should be handled",
      strategy: "conditional-access",
      rationale: "Add conditional branch with fallback behavior.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// TypeScript: Nullable property access
// ────────────────────────────────────────────

PLAYBOOKS.set("typescript.nullable-property-access", {
  class: "typescript.nullable-property-access",
  strategy_priority: ["guard-fail-fast", "type-narrowing", "conditional-access"],
  inspection_steps: [
    "Check the union type that includes undefined/null",
    "Trace where the object gets its type",
    "Check if a preceding check already narrows the type but TypeScript cannot infer it",
  ],
  anti_patterns: [
    "Do NOT use non-null assertion (!) without documented invariant",
    "Do NOT use as any",
    "Do NOT use @ts-ignore",
  ],
  decision_tree: [
    {
      condition: "The property access is inside a path that requires the object to exist",
      strategy: "guard-fail-fast",
      rationale: "Add a guard that throws or returns before the access.",
    },
    {
      condition: "The type can be narrowed with a typeof or instanceof check",
      strategy: "type-narrowing",
      rationale: "Add a type guard to narrow the union type.",
    },
    {
      condition: "The property access should be conditional on the object existing",
      strategy: "conditional-access",
      rationale: "Use optional chaining (?.) or a conditional branch.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// TypeScript: Missing property
// ────────────────────────────────────────────

PLAYBOOKS.set("typescript.missing-property", {
  class: "typescript.missing-property",
  strategy_priority: ["type-annotation-fix", "contract-fix"],
  inspection_steps: [
    "Check the type definition for the object",
    "Determine if the property should exist on the type",
    "Check if it's a typo in the property name",
    "Check if the type needs to be extended",
  ],
  anti_patterns: [
    "Do NOT cast to any",
    "Do NOT use bracket notation to bypass type checking",
  ],
  decision_tree: [
    {
      condition: "The property should exist but the type definition is missing it",
      strategy: "type-annotation-fix",
      rationale: "Add the property to the type definition.",
    },
    {
      condition: "The property name is misspelled",
      strategy: "type-annotation-fix",
      rationale: "Correct the typo.",
    },
    {
      condition: "The function contract should include this property",
      strategy: "contract-fix",
      rationale: "Update the function/interface contract to include the property.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// TypeScript: Type mismatch
// ────────────────────────────────────────────

PLAYBOOKS.set("typescript.type-mismatch", {
  class: "typescript.type-mismatch",
  strategy_priority: ["type-annotation-fix", "contract-fix", "type-narrowing"],
  inspection_steps: [
    "Compare the expected type vs the actual type",
    "Check if the value needs conversion or the type needs widening",
    "Check if the function parameter type is too strict or too loose",
  ],
  anti_patterns: [
    "Do NOT cast with 'as' unless the type relationship is genuinely safe",
    "Do NOT use any to silence the error",
  ],
  decision_tree: [
    {
      condition: "The actual type is a subset or convertible to the expected type",
      strategy: "type-narrowing",
      rationale: "Add proper conversion or narrowing.",
    },
    {
      condition: "The type annotation on the target is wrong",
      strategy: "type-annotation-fix",
      rationale: "Fix the annotation to match the actual valid types.",
    },
    {
      condition: "The function contract needs updating",
      strategy: "contract-fix",
      rationale: "Update the function signature to accept the actual types.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Runtime: Unhandled Promise Rejection
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.unhandled-promise-rejection", {
  class: "diagnostic.unhandled-promise-rejection",
  strategy_priority: ["promise-catch-chain", "runtime-try-catch"],
  inspection_steps: [
    "Identify the asynchronous function call missing a .catch() handler or not wrapped in try/catch.",
    "Determine if the promise is floating (fire-and-forget) or awaited.",
    "Check if the rejection should be gracefully ignored, logged, or bubbled up.",
  ],
  anti_patterns: [
    "Do NOT silence the error with an empty .catch(() => {}) without a comment explaining why.",
    "Do NOT add a generic process.on handler to bypass fixing the source.",
  ],
  decision_tree: [
    {
      condition: "The promise is part of a fluent chain or fire-and-forget",
      strategy: "promise-catch-chain",
      rationale: "Append .catch() to the end of the promise chain to safely handle the rejection.",
    },
    {
      condition: "The promise is awaited within an async function",
      strategy: "runtime-try-catch",
      rationale: "Wrap the await call in a try/catch block.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Runtime: Uncaught Exception
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.uncaught-exception", {
  class: "diagnostic.uncaught-exception",
  strategy_priority: ["runtime-try-catch", "guard-fail-fast"],
  inspection_steps: [
    "Analyze the stack trace to find the exact line throwing the Error or TypeError.",
    "Determine if this is an expected fallback case (e.g. JSON.parse failing) or a fatal logic bug.",
  ],
  anti_patterns: [
    "Do NOT catch(e) and ignore it. Always handle the error or supply a fallback.",
  ],
  decision_tree: [
    {
      condition: "The exception is thrown by a known volatile operation (like JSON.parse or fs.readFileSync)",
      strategy: "runtime-try-catch",
      rationale: "Wrap the operation in a try/catch and provide a fallback value.",
    },
    {
      condition: "The error is due to an invalid input state or undefined object",
      strategy: "guard-fail-fast",
      rationale: "Add a guard clause before the crash point to safely exit or return early.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Runtime: Memory Leak / Exhaustion
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.v8-heap-exhaustion", {
  class: "diagnostic.v8-heap-exhaustion",
  strategy_priority: ["contract-fix", "type-narrowing"],
  inspection_steps: [
    "Identify unbound arrays, maps, or closures in the recent logic that retain State or Log data indefinitely.",
    "Look for variables that grow per-session but are never cleared via a destructor or session deletion hook.",
  ],
  anti_patterns: [
    "Do NOT ignore memory thresholds. A process restart is a temporary fix; find the object owner.",
  ],
  decision_tree: [
    {
      condition: "The memory is consumed by a cache or ledger that grows unbounded",
      strategy: "contract-fix",
      rationale: "Implement an LRU cache, max-length truncate, or hook into session cleanup events to free memory.",
    },
  ],
  verification_command: "bun run typecheck",
})

PLAYBOOKS.set("diagnostic.v8-gc-thrashing", {
  class: "diagnostic.v8-gc-thrashing",
  strategy_priority: ["type-narrowing", "contract-fix"],
  inspection_steps: [
    "Identify tight loops creating massive amounts of short-lived objects (e.g. JSON.parse in a fast loop, array mapping).",
    "Check if we are reading large files synchronously on every tick.",
  ],
  anti_patterns: [
    "Do NOT force global.gc(); instead, reduce object allocations.",
  ],
  decision_tree: [
    {
      condition: "The thrashing is caused by repetitive object transformations in a loop",
      strategy: "type-narrowing",
      rationale: "Refactor to mutate objects heavily or object-pool instead of creating thousands of immutable copies.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Network: HTTP Timeout
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.http-timeout", {
  class: "diagnostic.http-timeout",
  strategy_priority: ["retry-with-backoff", "circuit-breaker"],
  inspection_steps: [
    "Check the URL and endpoint availability.",
    "Verify timeout configuration in the fetch/request options.",
    "Check if the server is under heavy load or if a proxy is intercepting.",
  ],
  anti_patterns: [
    "Do NOT retry infinitely without a backoff strategy.",
    "Do NOT suppress the timeout and return stale data without informing the user.",
  ],
  decision_tree: [
    {
      condition: "The endpoint is known to be slow or unreliable",
      strategy: "retry-with-backoff",
      rationale: "Wrap the fetch call with exponential backoff retry logic (e.g. 3 attempts with 1s, 2s, 4s delays).",
    },
    {
      condition: "The endpoint has been failing consistently",
      strategy: "circuit-breaker",
      rationale: "Implement a circuit breaker that stops calling after N consecutive failures and returns a cached/fallback response.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Network: DNS Resolution Failure
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.dns-resolution-failure", {
  class: "diagnostic.dns-resolution-failure",
  strategy_priority: ["retry-with-backoff", "guard-fail-fast"],
  inspection_steps: [
    "Verify the hostname is correct and not a typo.",
    "Check if the network is available (offline mode?).",
    "Check /etc/resolv.conf or DNS proxy configuration.",
  ],
  anti_patterns: [
    "Do NOT hardcode IP addresses to bypass DNS.",
  ],
  decision_tree: [
    {
      condition: "The DNS failure is transient (EAI_AGAIN)",
      strategy: "retry-with-backoff",
      rationale: "Retry after a short delay. DNS servers may have temporary issues.",
    },
    {
      condition: "The hostname is permanently unreachable",
      strategy: "guard-fail-fast",
      rationale: "Surface a clear error message to the user instead of hanging.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Network: Connection Reset
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.connection-reset", {
  class: "diagnostic.connection-reset",
  strategy_priority: ["reconnect-strategy", "retry-with-backoff"],
  inspection_steps: [
    "Check if this is a persistent connection (LSP, MCP, WebSocket) or a one-shot request.",
    "Determine if a proxy or firewall is killing idle connections.",
  ],
  anti_patterns: [
    "Do NOT silently drop the connection without notifying the user or retrying.",
  ],
  decision_tree: [
    {
      condition: "The connection is a persistent stream (WebSocket, MCP)",
      strategy: "reconnect-strategy",
      rationale: "Implement auto-reconnect with increasing backoff intervals.",
    },
    {
      condition: "The connection is a one-shot HTTP request",
      strategy: "retry-with-backoff",
      rationale: "Retry the request with exponential backoff.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Network: Rate Limit
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.rate-limit-hit", {
  class: "diagnostic.rate-limit-hit",
  strategy_priority: ["throttle-debounce", "retry-with-backoff"],
  inspection_steps: [
    "Check the Retry-After header in the 429 response.",
    "Identify which API endpoint is being rate-limited.",
    "Check if concurrent requests from multiple agents are exhausting the quota.",
  ],
  anti_patterns: [
    "Do NOT immediately retry without respecting the Retry-After header.",
    "Do NOT increase concurrency when hitting rate limits.",
  ],
  decision_tree: [
    {
      condition: "The API provides a Retry-After header",
      strategy: "retry-with-backoff",
      rationale: "Wait for the specified duration before retrying.",
    },
    {
      condition: "Multiple agents are sending concurrent requests",
      strategy: "throttle-debounce",
      rationale: "Implement a global request throttle or token bucket to limit concurrent API calls.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Network: WebSocket Disconnect
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.websocket-disconnect", {
  class: "diagnostic.websocket-disconnect",
  strategy_priority: ["reconnect-strategy"],
  inspection_steps: [
    "Check the WebSocket close code and reason.",
    "Determine if the server restarted or the network changed.",
  ],
  anti_patterns: [
    "Do NOT create a new connection on every message attempt. Use a single reconnection loop.",
  ],
  decision_tree: [
    {
      condition: "The WebSocket was closed unexpectedly",
      strategy: "reconnect-strategy",
      rationale: "Implement auto-reconnect with exponential backoff and state resynchronization.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Performance: Event Loop Block
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.event-loop-block", {
  class: "diagnostic.event-loop-block",
  strategy_priority: ["async-offload", "contract-fix"],
  inspection_steps: [
    "Identify the synchronous operation blocking the event loop (large JSON.parse, regex, file read).",
    "Check if the operation can be broken into smaller chunks or moved to a Worker thread.",
  ],
  anti_patterns: [
    "Do NOT add more synchronous I/O to compensate for the stall.",
    "Do NOT use process.nextTick in a tight loop.",
  ],
  decision_tree: [
    {
      condition: "The blocking operation is a large file read or JSON parse",
      strategy: "async-offload",
      rationale: "Use streaming APIs (createReadStream) or move to a Worker thread.",
    },
    {
      condition: "The blocking operation is a compute-heavy algorithm",
      strategy: "async-offload",
      rationale: "Break the work into chunks using setImmediate or move to a Worker.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Performance: Slow SQLite Query
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.slow-sqlite-query", {
  class: "diagnostic.slow-sqlite-query",
  strategy_priority: ["cache-optimization", "contract-fix"],
  inspection_steps: [
    "EXPLAIN QUERY PLAN the slow query to check if it's doing a full table scan.",
    "Check if an INDEX exists for the WHERE clause columns.",
    "Check if the query can be simplified or the result cached.",
  ],
  anti_patterns: [
    "Do NOT add SELECT * when only specific columns are needed.",
  ],
  decision_tree: [
    {
      condition: "The query is doing a full table scan on a large table",
      strategy: "cache-optimization",
      rationale: "Add an appropriate SQL INDEX on the filtered columns.",
    },
    {
      condition: "The query result is deterministic and frequently requested",
      strategy: "cache-optimization",
      rationale: "Cache the result in memory with a TTL or invalidation hook.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Performance: N+1 Query
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.n-plus-one-query", {
  class: "diagnostic.n-plus-one-query",
  strategy_priority: ["contract-fix"],
  inspection_steps: [
    "Find the loop issuing individual queries for each item.",
    "Check if the queries can be combined into a single batch using Promise.all or SQL IN clause.",
  ],
  anti_patterns: [
    "Do NOT execute database or API calls inside array.map/forEach loops.",
  ],
  decision_tree: [
    {
      condition: "The loop iterates over items and executes a query for each one",
      strategy: "contract-fix",
      rationale: "Refactor to collect all IDs first, then execute a single batched query.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Performance: Excessive FS Reads
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.excessive-fs-reads", {
  class: "diagnostic.excessive-fs-reads",
  strategy_priority: ["cache-optimization"],
  inspection_steps: [
    "Identify the file that is being re-read repeatedly.",
    "Check if the file content changes between reads or is static.",
  ],
  anti_patterns: [
    "Do NOT read configuration files inside hot loops.",
  ],
  decision_tree: [
    {
      condition: "The file is a static configuration that rarely changes",
      strategy: "cache-optimization",
      rationale: "Read the file once at startup and cache it. Use a file watcher to invalidate.",
    },
  ],
  verification_command: "bun run typecheck",
})

PLAYBOOKS.set("diagnostic.orphan-tooltips", {
  class: "diagnostic.orphan-tooltips",
  strategy_priority: ["state-management-fix"],
  inspection_steps: [
    "Identify stale tooltip/popover elements in the DOM.",
    "Trace their lifecycle to the parent anchor component.",
  ],
  anti_patterns: [],
  decision_tree: [
    {
      condition: "Tooltip remains after unmount",
      strategy: "state-management-fix",
      rationale: "Ensure the tooltip library's 'destroy' or 'unmount' method is called in the component cleanup hook.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Runtime: Performance (Category 4) — New Adds
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.react-unnecessary-rerender", {
  class: "diagnostic.react-unnecessary-rerender",
  strategy_priority: ["cache-optimization", "state-management-fix"],
  inspection_steps: [
    "Use React DevTools to see which props are changing.",
    "Check if props are new object references on every render.",
  ],
  anti_patterns: [],
  decision_tree: [
    {
      condition: "Props are identical by value but different by reference",
      strategy: "cache-optimization",
      rationale: "Wrap in React.memo and use useMemo/useCallback for props.",
    },
  ],
  verification_command: "bun run typecheck",
})

PLAYBOOKS.set("diagnostic.expensive-layout-thrashing", {
  class: "diagnostic.expensive-layout-thrashing",
  strategy_priority: ["layout-fix"],
  inspection_steps: [
    "Search for writes to style/className immediately following reads from offsetHeight/clientWidth.",
  ],
  anti_patterns: [],
  decision_tree: [
    {
      condition: "Read-write cycle in a loop",
      strategy: "layout-fix",
      rationale: "Batch reads first, then batch writes, or use requestAnimationFrame.",
    },
  ],
  verification_command: "bun run typecheck",
})

PLAYBOOKS.set("diagnostic.unoptimized-image-load", {
  class: "diagnostic.unoptimized-image-load",
  strategy_priority: ["layout-fix"],
  inspection_steps: [
    "Check image dimensions vs display size.",
    "Verify presence of 'loading=lazy' and 'decoding=async'.",
  ],
  anti_patterns: [],
  decision_tree: [
    {
      condition: "Large raw image used as thumbnail",
      strategy: "layout-fix",
      rationale: "Apply loading='lazy' and explicit width/height to avoid CLS.",
    },
  ],
  verification_command: "bun run typecheck",
})

PLAYBOOKS.set("diagnostic.pty-session-missing", {
  class: "diagnostic.pty-session-missing",
  strategy_priority: ["reconnect-strategy", "state-management-fix"],
  inspection_steps: [
    "Check if the PTY ID exists in the backend memory map",
    "Verify the instance directory matches the client request",
    "Identify if a server restart occurred recently",
  ],
  anti_patterns: [
    "Infinite retry loop on 404",
    "Maintaining stale session IDs in local storage across server restarts",
  ],
  decision_tree: [
    {
      condition: "PTY session not found on server (404)",
      strategy: "reconnect-strategy",
      rationale: "Allocate a new PTY session and update the client-side state to prevent infinite retry loops.",
    },
  ],
  verification_command: "bun run typecheck",
});

PLAYBOOKS.set("diagnostic.long-task-detector", {
  class: "diagnostic.long-task-detector",
  strategy_priority: ["async-offload", "throttle-debounce"],
  inspection_steps: [
    "Identify the JS function blocking the main thread.",
    "Check for heavy computation or massive DOM updates.",
  ],
  anti_patterns: [],
  decision_tree: [
    {
      condition: "Computationally expensive JS",
      strategy: "async-offload",
      rationale: "Move logic to a Web Worker or break into chunks using setImmediate.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// UI/UX: Element Overlap
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.element-overlap", {
  class: "diagnostic.element-overlap",
  strategy_priority: ["layout-fix"],
  inspection_steps: [
    "Identify the overlapping elements and their CSS positioning.",
    "Check for absolute/fixed positioning without proper stacking context.",
    "Verify flex/grid layout constraints.",
  ],
  anti_patterns: [
    "Do NOT fix overlaps by adding more z-index values.",
  ],
  decision_tree: [
    {
      condition: "Elements overlap due to absolute positioning",
      strategy: "layout-fix",
      rationale: "Refactor to use CSS Grid or Flexbox for proper layout flow.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// UI/UX: Unresponsive Target (Rage Click)
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.unresponsive-target", {
  class: "diagnostic.unresponsive-target",
  strategy_priority: ["state-management-fix", "layout-fix"],
  inspection_steps: [
    "Check if the button's onClick handler is bound correctly.",
    "Verify the button is not covered by an invisible overlay.",
    "Check if the handler is async and the button lacks a loading/disabled state.",
  ],
  anti_patterns: [
    "Do NOT assume the user is clicking wrong. If rage-clicks are detected, the button is broken.",
  ],
  decision_tree: [
    {
      condition: "The button handler is async and has no loading state",
      strategy: "state-management-fix",
      rationale: "Add a loading/disabled state while the async operation runs to prevent double-clicks.",
    },
    {
      condition: "The button is visually obscured by another element",
      strategy: "layout-fix",
      rationale: "Fix the z-index or remove the overlapping element.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// UI/UX: Color Contrast Violation
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.color-contrast-violation", {
  class: "diagnostic.color-contrast-violation",
  strategy_priority: ["accessibility-fix"],
  inspection_steps: [
    "Check the foreground text color against the background color.",
    "Calculate the WCAG 2.1 contrast ratio.",
    "Verify the font size (larger text has lower contrast requirements).",
  ],
  anti_patterns: [
    "Do NOT use pure aesthetics to override accessibility requirements.",
  ],
  decision_tree: [
    {
      condition: "The contrast ratio is below WCAG AA standard (4.5:1)",
      strategy: "accessibility-fix",
      rationale: "Adjust the text or background color to meet the minimum 4.5:1 contrast ratio for normal text.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// UI/UX: Missing Loading State
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.missing-loading-state", {
  class: "diagnostic.missing-loading-state",
  strategy_priority: ["state-management-fix"],
  inspection_steps: [
    "Find buttons or forms that trigger async operations.",
    "Check if the button enters a disabled or spinner state during the operation.",
  ],
  anti_patterns: [
    "Do NOT leave interactive elements clickable during async operations.",
  ],
  decision_tree: [
    {
      condition: "A button triggers a fetch/API call without disabling itself",
      strategy: "state-management-fix",
      rationale: "Set the button to disabled with a loading indicator until the operation completes.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// UI/UX: Z-Index War
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.z-index-war", {
  class: "diagnostic.z-index-war",
  strategy_priority: ["layout-fix"],
  inspection_steps: [
    "Audit all z-index values in the stylesheet.",
    "Check for arbitrary high values (9999, 99999).",
    "Verify stacking contexts are properly isolated.",
  ],
  anti_patterns: [
    "Do NOT fix z-index issues by adding higher z-index values.",
  ],
  decision_tree: [
    {
      condition: "Multiple elements compete with arbitrarily high z-index values",
      strategy: "layout-fix",
      rationale: "Implement a z-index registry using CSS custom properties with semantic names (--z-modal, --z-dropdown, --z-tooltip).",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// UI/UX: Layout Shift (CLS)
// ────────────────────────────────────────────

PLAYBOOKS.set("diagnostic.layout-shift-cls", {
  class: "diagnostic.layout-shift-cls",
  strategy_priority: ["layout-fix"],
  inspection_steps: [
    "Identify elements that shift position after async data loads.",
    "Check if images or containers have explicit width/height or aspect-ratio.",
  ],
  anti_patterns: [
    "Do NOT load content without reserving space with skeleton loaders.",
  ],
  decision_tree: [
    {
      condition: "Content shifts because async data inserts new DOM nodes",
      strategy: "layout-fix",
      rationale: "Add skeleton loaders or reserve explicit dimensions for async content containers.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Look up a repair playbook for a given diagnostic class.
 * Returns undefined for unknown classes.
 */
export function getPlaybook(diagnosticClass: DiagnosticClass): RepairPlaybook | undefined {
  return PLAYBOOKS.get(diagnosticClass)
}

/**
 * Check if a playbook exists for a given diagnostic class.
 */
export function hasPlaybook(diagnosticClass: DiagnosticClass): boolean {
  return PLAYBOOKS.has(diagnosticClass)
}

/**
 * Get all registered diagnostic classes that have playbooks.
 */
export function getRegisteredClasses(): DiagnosticClass[] {
  return [...PLAYBOOKS.keys()]
}
