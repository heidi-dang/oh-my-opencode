/// <reference types="bun-types/test-globals" />
import type { Task } from "../../features/claude-tasks/types";
import { syncAllTasksToTodos, type TodoInfo } from "./todo-sync";

describe("syncAllTasksToTodos", () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      client: {
        session: {
          todo: vi.fn(),
        },
      },
    };
  });

  it("removes deleted tasks from todo list", async () => {
    // given
    const tasks: Task[] = [
      {
        id: "T-1",
        subject: "Task 1",
        description: "Description 1",
        status: "deleted",
        blocks: [],
        blockedBy: [],
      },
    ];
    const currentTodos: TodoInfo[] = [
      {
        id: "T-1",
        content: "Task 1",
        status: "pending",
      },
    ];
    mockCtx.client.session.todo.mockResolvedValue(currentTodos);
    let writtenTodos: TodoInfo[] = [];
    const writer = async (input: { sessionID: string; todos: TodoInfo[] }) => {
      writtenTodos = input.todos;
    };

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1", writer);

    // then
    expect(writtenTodos.some((t: TodoInfo) => t.id === "T-1")).toBe(false);
  });

  it("preserves existing todos not in task list", async () => {
    // given
    const tasks: Task[] = [
      {
        id: "T-1",
        subject: "Task 1",
        description: "Description 1",
        status: "pending",
        blocks: [],
        blockedBy: [],
      },
    ];
    const currentTodos: TodoInfo[] = [
      {
        id: "T-1",
        content: "Task 1",
        status: "pending",
      },
      {
        id: "T-existing",
        content: "Existing todo",
        status: "pending",
      },
    ];
    mockCtx.client.session.todo.mockResolvedValue(currentTodos);
    let writtenTodos: TodoInfo[] = [];
    const writer = async (input: { sessionID: string; todos: TodoInfo[] }) => {
      writtenTodos = input.todos;
    };

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1", writer);

    // then
    expect(writtenTodos.some((t: TodoInfo) => t.id === "T-existing")).toBe(true);
    expect(writtenTodos.some((t: TodoInfo) => t.content === "Task 1")).toBe(true);
  });

  it("calls writer with final todos", async () => {
    // given
    const tasks: Task[] = [
      {
        id: "T-1",
        subject: "Task 1",
        description: "Description 1",
        status: "pending",
        blocks: [],
        blockedBy: [],
      },
    ];
    mockCtx.client.session.todo.mockResolvedValue([]);
    let writerCalled = false;
    const writer = async (input: { sessionID: string; todos: TodoInfo[] }) => {
      writerCalled = true;
      expect(input.sessionID).toBe("session-1");
      expect(input.todos.length).toBe(1);
      expect(input.todos[0].content).toBe("Task 1");
    };

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1", writer);

    // then
    expect(writerCalled).toBe(true);
  });

  it("deduplicates no-id todos when task replaces existing content", async () => {
    // given
    const tasks: Task[] = [
      {
        id: "T-1",
        subject: "Task 1 (updated)",
        description: "Description 1",
        status: "in_progress",
        blocks: [],
        blockedBy: [],
      },
    ];
    const currentTodos: TodoInfo[] = [
      {
        content: "Task 1 (updated)",
        status: "pending",
      },
    ];
    mockCtx.client.session.todo.mockResolvedValue(currentTodos);
    let writtenTodos: TodoInfo[] = [];
    const writer = async (input: { sessionID: string; todos: TodoInfo[] }) => {
      writtenTodos = input.todos;
    };

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1", writer);

    // then — no duplicates
    const matching = writtenTodos.filter((t: TodoInfo) => t.content === "Task 1 (updated)");
    expect(matching.length).toBe(1);
    expect(matching[0].status).toBe("in_progress");
  });

  it("preserves todos without id field", async () => {
    // given
    const tasks: Task[] = [
      {
        id: "T-1",
        subject: "Task 1",
        description: "Description 1",
        status: "pending",
        blocks: [],
        blockedBy: [],
      },
    ];
    const currentTodos: TodoInfo[] = [
      {
        id: "T-1",
        content: "Task 1",
        status: "pending",
      },
      {
        content: "Todo without id",
        status: "pending",
      },
    ];
    mockCtx.client.session.todo.mockResolvedValue(currentTodos);

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1");

    // then
    expect(mockCtx.client.session.todo).toHaveBeenCalled();
  });
});
