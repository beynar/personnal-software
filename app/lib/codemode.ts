import { env } from "cloudflare:workers";
/**
 * Cloudflare Codemode runtime — sandboxed code execution via Dynamic Workers.
 *
 * Uses the LOADER binding declared in wrangler.toml (`worker_loaders`)
 * to spin up isolated Worker instances at runtime. Auth secrets never
 * enter the sandbox — tool calls dispatch back to the host via Workers RPC.
 *
 * Usage from a server-side handler:
 *
 *   import { getExecutor } from "~/lib/codemode";
 *   const executor = getExecutor();
 *   const result = await executor.execute(code, fns);
 */
import { DynamicWorkerExecutor } from "@cloudflare/codemode";

// The LOADER binding is a WorkerLoader provided by the Cloudflare runtime.
// TypeScript doesn't have the type without cf-typegen, so we cast through
// the env record.
// biome-ignore lint/suspicious/noExplicitAny: WorkerLoader type is a runtime binding, not available in TS without cf-typegen
const getLoader = () => (env as Record<string, any>).LOADER;

/**
 * Returns a DynamicWorkerExecutor backed by the LOADER binding.
 *
 * Called per-request so the executor always uses the current env.
 * Network access is blocked by default (globalOutbound: null).
 */
export function getExecutor(): DynamicWorkerExecutor {
	return new DynamicWorkerExecutor({
		loader: getLoader(),
		globalOutbound: null,
	});
}
