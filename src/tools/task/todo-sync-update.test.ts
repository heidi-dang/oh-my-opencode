/// <reference types="bun-types/test-globals" />
import type { Task } from "../../features/claude-tasks/types";
import { syncTaskTodoUpdate, type TodoInfo } from "./todo-sync";

describe("syncTaskTodoUpdate", () => {
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

  it("writes updated todo and preserves existing items", async () => {
    // given
    const task: Task = {
      id: "T-1",
      subject: "Updated task",
      description: "",
      status: "in_progress",
      blocks: [],
      blockedBy: [],
    };
    const currentTodos: TodoInfo[] = [
      { id: "T-1", content: "Old task", status: "pending" },
      { id: "T-2", content: "Keep task", status: "pending" },
    ];
    mockCtx.client.session.todo.mockResolvedValue({ data: currentTodos });
    let called = false;
    const writer = async (input: { sessionID: string; todos: TodoInfo[] }) => {
      called = true;
      expect(input.sessionID).toBe("session-1");
      expect(input.todos.length).toBe(2);
      expect(
        input.todos.find((todo: TodoInfo) => todo.id === "T-1")?.content,
      ).toBe("Updated task");
      expect(input.todos.some((todo: TodoInfo) => todo.id === "T-2")).toBe(
        true,
      );
    };

    // when
    await syncTaskTodoUpdate(mockCtx, task, "session-1", writer);

    // then
    expect(called).toBe(true);
  });

  it("removes deleted task from todos", async () => {
    // given
    const task: Task = {
      id: "T-1",
      subject: "Deleted task",
      description: "",
      status: "deleted",
      blocks: [],
      blockedBy: [],
    };
    const currentTodos: TodoInfo[] = [
      { id: "T-1", content: "Old task", status: "pending" },
      { id: "T-2", content: "Keep task", status: "pending" },
    ];
    mockCtx.client.session.todo.mockResolvedValue(currentTodos);
    let called = false;
    const writer = async (input: { sessionID: string; todos: TodoInfo[] }) => {
      called = true;
      expect(input.todos.length).toBe(1);
      expect(input.todos.some((todo: TodoInfo) => todo.id === "T-1")).toBe(
        false,
      );
      expect(input.todos.some((todo: TodoInfo) => todo.id === "T-2")).toBe(
        true,
      );
    };

    // when
    await syncTaskTodoUpdate(mockCtx, task, "session-1", writer);

    // then
    expect(called).toBe(true);
  });
});
