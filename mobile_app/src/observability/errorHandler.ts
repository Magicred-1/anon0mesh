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

    if (__DEV__ && typeof previous === 'function') {
      previous(error, isFatal);
    }
  });
}
