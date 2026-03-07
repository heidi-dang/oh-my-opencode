/// <reference types="bun-types/test-globals" />
import type { Task } from "../../features/claude-tasks/types";
import { syncTaskToTodo, type TodoInfo } from "./todo-sync";

describe("syncTaskToTodo", () => {
  it("converts pending task to pending todo", () => {
    // given
    const task: Task = {
      id: "T-123",
      subject: "Fix bug",
      description: "Fix critical bug",
      status: "pending",
      blocks: [],
      blockedBy: [],
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result).toEqual({
      id: "T-123",
      content: "Fix bug",
      status: "pending",
      priority: undefined,
    });
  });

  it("converts in_progress task to in_progress todo", () => {
    // given
    const task: Task = {
      id: "T-456",
      subject: "Implement feature",
      description: "Add new feature",
      status: "in_progress",
      blocks: [],
      blockedBy: [],
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result?.status).toBe("in_progress");
    expect(result?.content).toBe("Implement feature");
  });

  it("converts completed task to completed todo", () => {
    // given
    const task: Task = {
      id: "T-789",
      subject: "Review PR",
      description: "Review pull request",
      status: "completed",
      blocks: [],
      blockedBy: [],
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result?.status).toBe("completed");
  });

  it("returns null for deleted task", () => {
    // given
    const task: Task = {
      id: "T-del",
      subject: "Deleted task",
      description: "This task is deleted",
      status: "deleted",
      blocks: [],
      blockedBy: [],
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result).toBeNull();
  });

  it("extracts priority from metadata", () => {
    // given
    const task: Task = {
      id: "T-high",
      subject: "Critical task",
      description: "High priority task",
      status: "pending",
      blocks: [],
      blockedBy: [],
      metadata: { priority: "high" },
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result?.priority).toBe("high");
  });

  it("handles medium priority", () => {
    // given
    const task: Task = {
      id: "T-med",
      subject: "Medium task",
      description: "Medium priority",
      status: "pending",
      blocks: [],
      blockedBy: [],
      metadata: { priority: "medium" },
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result?.priority).toBe("medium");
  });

  it("handles low priority", () => {
    // given
    const task: Task = {
      id: "T-low",
      subject: "Low task",
      description: "Low priority",
      status: "pending",
      blocks: [],
      blockedBy: [],
      metadata: { priority: "low" },
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result?.priority).toBe("low");
  });

  it("ignores invalid priority values", () => {
    // given
    const task: Task = {
      id: "T-invalid",
      subject: "Invalid priority",
      description: "Invalid priority value",
      status: "pending",
      blocks: [],
      blockedBy: [],
      metadata: { priority: "urgent" },
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result?.priority).toBeUndefined();
  });

  it("handles missing metadata", () => {
    // given
    const task: Task = {
      id: "T-no-meta",
      subject: "No metadata",
      description: "Task without metadata",
      status: "pending",
      blocks: [],
      blockedBy: [],
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result?.priority).toBeUndefined();
  });

  it("uses subject as todo content", () => {
    // given
    const task: Task = {
      id: "T-content",
      subject: "This is the subject",
      description: "This is the description",
      status: "pending",
      blocks: [],
      blockedBy: [],
    };

    // when
    const result = syncTaskToTodo(task);

    // then
    expect(result?.content).toBe("This is the subject");
  });
});
