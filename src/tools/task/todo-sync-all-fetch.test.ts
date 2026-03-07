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

  it("fetches current todos from OpenCode", async () => {
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
        id: "T-existing",
        content: "Existing todo",
        status: "pending",
      },
    ];
    mockCtx.client.session.todo.mockResolvedValue(currentTodos);

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1");

    // then
    expect(mockCtx.client.session.todo).toHaveBeenCalledWith({
      path: { id: "session-1" },
    });
  });

  it("handles API response with data property", async () => {
    // given
    const tasks: Task[] = [];
    const currentTodos: TodoInfo[] = [
      {
        id: "T-1",
        content: "Todo 1",
        status: "pending",
      },
    ];
    mockCtx.client.session.todo.mockResolvedValue({
      data: currentTodos,
    });

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1");

    // then
    expect(mockCtx.client.session.todo).toHaveBeenCalled();
  });

  it("gracefully handles fetch failure", async () => {
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
    mockCtx.client.session.todo.mockRejectedValue(new Error("API error"));

    // when
    const result = await syncAllTasksToTodos(mockCtx, tasks, "session-1");

    // then
    expect(result).toBeUndefined();
  });

  it("converts multiple tasks to todos", async () => {
    // given
    const tasks: Task[] = [
      {
        id: "T-1",
        subject: "Task 1",
        description: "Description 1",
        status: "pending",
        blocks: [],
        blockedBy: [],
        metadata: { priority: "high" },
      },
      {
        id: "T-2",
        subject: "Task 2",
        description: "Description 2",
        status: "in_progress",
        blocks: [],
        blockedBy: [],
        metadata: { priority: "low" },
      },
    ];
    mockCtx.client.session.todo.mockResolvedValue([]);

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1");

    // then
    expect(mockCtx.client.session.todo).toHaveBeenCalled();
  });

  it("handles empty task list", async () => {
    // given
    const tasks: Task[] = [];
    mockCtx.client.session.todo.mockResolvedValue([]);

    // when
    await syncAllTasksToTodos(mockCtx, tasks, "session-1");

    // then
    expect(mockCtx.client.session.todo).toHaveBeenCalled();
  });
});
