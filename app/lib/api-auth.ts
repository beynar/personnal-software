/**
 * Shared server-side auth helper for validating API keys.
 *
 * Calls Better Auth's /get-session endpoint with the x-api-key header,
 * which — thanks to enableSessionForAPIKeys — returns a normalized
 * user + session result without a second lookup.
 *
 * Usage:
 *   const result = await validateApiKey(apiKey);
 *   if (!result) return new Response("Unauthorized", { status: 401 });
 *   // result.user and result.session are available
 */

const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string;

export interface ApiAuthUser {
	id: string;
	email: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface ApiAuthSession {
	id: string;
	userId: string;
	token: string;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface ApiAuthResult {
	user: ApiAuthUser;
	session: ApiAuthSession;
}

/**
 * Validates an API key by calling Better Auth's /get-session with the
 * x-api-key header. The API key plugin's enableSessionForAPIKeys option
 * causes the plugin to intercept the request, verify the key, and return
 * a mock session — no separate verifyApiKey + session lookup needed.
 *
 * Returns the user and session if valid, or null otherwise.
 */
export async function validateApiKey(
	apiKey: string,
): Promise<ApiAuthResult | null> {
	try {
		const response = await fetch(`${convexSiteUrl}/api/auth/get-session`, {
			headers: { "x-api-key": apiKey },
		});
		if (!response.ok) return null;
		const data = (await response.json()) as Record<string, unknown>;
		if (!data?.user) return null;
		return data as unknown as ApiAuthResult;
	} catch {
		return null;
	}
}

/**
 * Extracts an API key from a request's x-api-key header.
 * Returns null if the header is missing or empty.
 */
export function extractApiKey(request: Request): string | null {
	return request.headers.get("x-api-key") || null;
}
