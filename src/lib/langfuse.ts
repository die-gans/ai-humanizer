import { LangfuseSpanProcessor } from "@langfuse/otel";
import { LangfuseClient } from "@langfuse/client";

/**
 * Shared Langfuse singletons.
 *
 * Both read credentials from env: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY,
 * LANGFUSE_BASE_URL (see .env.local).
 *
 * - `langfuseSpanProcessor` is registered by `src/instrumentation.ts` and
 *   exports traces created by the Vercel AI SDK's OpenTelemetry telemetry.
 * - `langfuse` (client) is used to attach detector scores to those traces.
 */
// Next.js bundles instrumentation.ts and route handlers in separate module
// graphs, which would otherwise create two processor instances — the one that's
// registered vs. the one we forceFlush(). Pin both to globalThis so the
// instance we flush is the same one that exports spans.
const g = globalThis as unknown as {
  __lfProcessor?: LangfuseSpanProcessor;
  __lfClient?: LangfuseClient;
};

export const langfuseSpanProcessor =
  g.__lfProcessor ?? (g.__lfProcessor = new LangfuseSpanProcessor());

export const langfuse = g.__lfClient ?? (g.__lfClient = new LangfuseClient());
