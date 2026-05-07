export interface ErrorSummary {
  message: string;
  name?: string;
  code?: string | number;
  stack?: string;
  raw?: string;
  cause?: string;
}

function readObjectField(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

function readStringField(obj: Record<string, unknown>, key: string): string | undefined {
  const value = readObjectField(obj, key);
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function safeStringify(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim().length > 0 ? value : undefined;
  }

  if (value instanceof Error) {
    const parts = [value.name, value.message].filter(Boolean).join(": ");
    return parts.length > 0 ? parts : undefined;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== "{}" ? serialized : undefined;
  } catch {
    return undefined;
  }
}

export function summarizeError(
  err: unknown,
  fallback = "Unknown error",
): ErrorSummary {
  if (err instanceof Error) {
    const message = err.message.trim().length > 0 ? err.message : fallback;
    const summary: ErrorSummary = {
      message,
      name: err.name,
      stack: err.stack,
    };
    if (err.cause) summary.cause = safeStringify(err.cause);
    return summary;
  }

  if (typeof err === "string") {
    return { message: err.trim().length > 0 ? err : fallback };
  }

  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const message = readStringField(record, "message");
    const name = readStringField(record, "name") ?? readStringField(record, "error");
    const codeValue = readObjectField(record, "code");
    const code =
      typeof codeValue === "string" || typeof codeValue === "number" ? codeValue : undefined;
    const raw = safeStringify(err);
    const parts = [name, code !== undefined ? String(code) : undefined].filter(Boolean);

    return {
      message: message ?? (parts.length > 0 ? parts.join(" ") : fallback),
      name,
      code,
      raw,
      cause: safeStringify(readObjectField(record, "cause")),
    };
  }

  return { message: fallback, raw: safeStringify(err) };
}
