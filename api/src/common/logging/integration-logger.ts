import { Logger } from '@nestjs/common';

export type IntegrationLogOutcome = 'started' | 'succeeded' | 'failed';

export type IntegrationLogEvent = {
  provider: string;
  operation: string;
  outcome: IntegrationLogOutcome;
  requestId?: string;
  referenceId?: string;
  targetHost?: string;
  statusCode?: number;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  context?: Record<string, string | number | boolean | null | undefined>;
};

export function logIntegrationEvent(
  logger: Logger,
  event: IntegrationLogEvent,
): void {
  const level =
    event.outcome === 'failed'
      ? 'warn'
      : event.outcome === 'started'
        ? 'debug'
        : 'log';

  logger[level](
    JSON.stringify({
      event: 'external_integration',
      ...omitUndefined(event),
    }),
  );
}

export function integrationTargetHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

export function durationSince(startTimeMs: number): number {
  return Date.now() - startTimeMs;
}

function omitUndefined<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
