# Implementation: Subagent Progress Bars

## Schema & Phases

### Events (`oh-my-opencode:progress`)
```json
{
  "type": "progress",
  "properties": {
    "taskID": "string",
    "phase": "string",
    "status": "queued | start | progress | complete | fail",
    "percent": "number (0-100)",
    "message": "string"
  }
}
```

### Phases
- `queued`: Waiting for a free worker.
- `initializing`: Setting up agent environment.
- `researching`: Gathering context.
- `executing`: Running tools.
- `verifying`: Running tests or checks.
- `finishing`: Writing output.

## UI Implementation
- **Exact**: Solid bar with percentage text.
- **Indeterminate**: Pulsing blue bar for unknown durations.
- **Multi-sub**: Stacked bars or nested indicators for parallel sub-tasks.
- **Fallback**: Display as text in sidecar if UI cannot render bar.

## Doctor Check
`oh-my-opencode doctor` will include `checkProgressIntegrity`:
- Simulates a task lifecycle.
- Verifies all required events are emitted.
- Checks for out-of-order or missing percentages.
