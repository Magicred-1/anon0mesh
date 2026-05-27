type ErrorHandler = (error: Error, isFatal?: boolean) => void;

/**
 * Installs a global handler for unhandled async JS errors.
 * Preserves the previous handler so other tooling (dev menu, etc.) still runs.
 * Logs at console.error level — no error swallowing.
 */
export function installGlobalErrorHandler(): void {
  const previous = ErrorUtils.getGlobalHandler() as ErrorHandler | null;

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    console.error(
      `[GlobalErrorHandler] ${isFatal ? 'FATAL' : 'non-fatal'} unhandled error:`,
      error,
    );

    // Always chain to the previous handler. In production that is React
    // Native's native fatal-error path (crash dialog + process teardown);
    // gating it on __DEV__ would silently swallow fatal errors in release and
    // leave the app limping with no crash signal. The ErrorBoundary handles
    // recoverable render throws — this preserves the platform crash path.
    if (typeof previous === 'function') {
      previous(error, isFatal);
    }
  });
}
