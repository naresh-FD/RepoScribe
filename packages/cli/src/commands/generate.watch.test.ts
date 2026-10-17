import * as path from "node:path";
import type { GenerateResult, Logger } from "@docgen/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchAndRegenerate } from "./generate";

// AUDIT-001 / RS-06: watch mode regenerates after a debounce and never runs two generations at once.
// A fake watcher stands in for fs.watch, and fake timers for the debounce.

type Listener = (event: string, file: string | null) => void;

function fakeWatcher() {
  const listeners: Listener[] = [];
  const errorHandlers: Array<(error: Error) => void> = [];
  const roots: Array<{ dir: string; recursive: boolean | undefined }> = [];
  const watch = vi.fn((dir: string, options: { recursive?: boolean }, listener: Listener) => {
    roots.push({ dir, recursive: options.recursive });
    listeners.push(listener);
    const watcher = {
      on: vi.fn((event: string, handler: (error: Error) => void) => {
        if (event === "error") errorHandlers.push(handler);
        return watcher;
      }),
    };
    return watcher;
  });
  return {
    watch: watch as never,
    roots,
    emit: (file: string | null = "src/a.ts") => {
      for (const listener of listeners) listener("change", file);
    },
    fail: (error: Error) => {
      for (const handler of errorHandlers) handler(error);
    },
  };
}

function loggerSpy(): Logger & { messages: string[]; errors: string[] } {
  const messages: string[] = [];
  const errors: string[] = [];
  return {
    messages,
    errors,
    debug() {},
    info: (message: string) => void messages.push(message),
    warn() {},
    error: (message: string) => void errors.push(message),
    success() {},
  } as never;
}

const config = { languages: [{ source: "src" }] };
const result = {} as GenerateResult;

describe("watchAndRegenerate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("watches every language source root recursively", () => {
    const fake = fakeWatcher();
    const logger = loggerSpy();
    void watchAndRegenerate(
      { languages: [{ source: "src/client" }, { source: "src/server/java" }] },
      "/work",
      logger,
      async () => result,
      { watch: fake.watch },
    );

    expect(fake.roots).toEqual([
      { dir: path.resolve("/work", "src/client"), recursive: true },
      { dir: path.resolve("/work", "src/server/java"), recursive: true },
    ]);
    expect(logger.messages.join("\n")).toContain("Watching 2 source root(s)");
  });

  it("waits for the debounce, then regenerates once for a burst of changes", async () => {
    const fake = fakeWatcher();
    const generate = vi.fn(async () => result);
    void watchAndRegenerate(config, "/work", loggerSpy(), generate, { watch: fake.watch, debounceMs: 200 });

    fake.emit();
    await vi.advanceTimersByTimeAsync(100);
    fake.emit();
    await vi.advanceTimersByTimeAsync(100);
    fake.emit();
    await vi.advanceTimersByTimeAsync(199);
    expect(generate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("uses a 200 ms debounce by default", async () => {
    const fake = fakeWatcher();
    const generate = vi.fn(async () => result);
    void watchAndRegenerate(config, "/work", loggerSpy(), generate, { watch: fake.watch });

    fake.emit();
    await vi.advanceTimersByTimeAsync(199);
    expect(generate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("never runs two generations at once: a change during a run is queued and run afterwards", async () => {
    const fake = fakeWatcher();
    let finishFirst: () => void = () => undefined;
    const generate = vi
      .fn<[], Promise<GenerateResult>>()
      .mockImplementationOnce(() => new Promise<GenerateResult>((resolve) => (finishFirst = () => resolve(result))))
      .mockResolvedValue(result);
    void watchAndRegenerate(config, "/work", loggerSpy(), generate, { watch: fake.watch, debounceMs: 200 });

    fake.emit();
    await vi.advanceTimersByTimeAsync(200);
    expect(generate).toHaveBeenCalledTimes(1);

    fake.emit();
    await vi.advanceTimersByTimeAsync(200);
    expect(generate).toHaveBeenCalledTimes(1); // still the first run: the change is queued

    finishFirst();
    await vi.advanceTimersByTimeAsync(200);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("logs a failed generation and keeps watching", async () => {
    const fake = fakeWatcher();
    const logger = loggerSpy();
    const generate = vi
      .fn<[], Promise<GenerateResult>>()
      .mockRejectedValueOnce(new Error("parse exploded"))
      .mockResolvedValue(result);
    void watchAndRegenerate(config, "/work", logger, generate, { watch: fake.watch, debounceMs: 200 });

    fake.emit();
    await vi.advanceTimersByTimeAsync(200);
    expect(logger.errors).toEqual(["parse exploded"]);

    fake.emit();
    await vi.advanceTimersByTimeAsync(200);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("rejects when a watcher reports an error", async () => {
    const fake = fakeWatcher();
    const done = watchAndRegenerate(config, "/work", loggerSpy(), async () => result, { watch: fake.watch });
    const outcome = expect(done).rejects.toThrow("watch limit reached");

    fake.fail(new Error("watch limit reached"));

    await outcome;
  });
});
