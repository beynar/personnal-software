export type McpSession = {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: Date | string;
	refreshTokenExpiresAt: Date | string;
	clientId: string;
	userId: string;
	scopes: string;
};

export function createRestAuthHeaders(
	headers: Headers,
): Record<string, string> {
	const forwarded = new Headers();
	const apiKey = headers.get("x-api-key");
	if (apiKey) {
		forwarded.set("authorization", `Bearer ${apiKey}`);
		return Object.fromEntries(forwarded.entries());
	}

	const authorization = headers.get("authorization");
	if (authorization) {
		forwarded.set("authorization", authorization);
	}

	return Object.fromEntries(forwarded.entries());
}
