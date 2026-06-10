import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { langfuseSpanProcessor } from "./lib/langfuse";

/**
 * Next.js runs this once at server startup. We register a Node OpenTelemetry
 * tracer provider with Langfuse's span processor so the Vercel AI SDK's
 * telemetry spans (model, tokens, latency) are exported to Langfuse.
 *
 * Per Langfuse's Next.js guide we use a manual NodeTracerProvider rather than
 * `registerOTel` from @vercel/otel (which lacks OTel JS SDK v2 compatibility).
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const provider = new NodeTracerProvider({
    spanProcessors: [langfuseSpanProcessor],
  });
  provider.register();
}
