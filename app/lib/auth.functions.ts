import { createServerFn } from "@tanstack/react-start";
import { getToken } from "~/lib/auth-server";

export type BetterAuthSessionStatus =
	| "anonymous"
	| "authenticated"
	| "unavailable";

/**
 * Resolves the current request session without collapsing auth transport
 * failures into an anonymous user. Route guards can avoid false logout
 * redirects while Convex still enforces data access server-side.
 */
async function resolveBetterAuthSessionStatus(): Promise<BetterAuthSessionStatus> {
	try {
		const token = await getToken();
		return token ? "authenticated" : "anonymous";
	} catch (err) {
		console.error("[auth-session] Better Auth session check unavailable:", err);
		return "unavailable";
	}
}

export const getBetterAuthSessionStatus = createServerFn({
	method: "GET",
}).handler(resolveBetterAuthSessionStatus);
