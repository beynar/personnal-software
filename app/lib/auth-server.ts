import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string;

const upstream = convexBetterAuthReactStart({
	convexUrl,
	convexSiteUrl,
	jwtCache: {
		enabled: true,
		expirationToleranceSeconds: 60,
		isAuthError,
	},
});

export const getToken = upstream.getToken;

export const handler = async (request: Request): Promise<Response> => {
	try {
		return await upstream.handler(request);
	} catch (err) {
		console.error("[auth-handler] caught error:", err);
		return Response.json(
			{ error: { message: "Auth service unavailable" } },
			{ status: 502 },
		);
	}
};

export const fetchAuthQuery = upstream.fetchAuthQuery;
export const fetchAuthMutation = upstream.fetchAuthMutation;

function isAuthError(error: unknown) {
	if (!(error instanceof Error)) {
		return false;
	}

	return /\b(unauthenticated|unauthorized|not authenticated)\b/i.test(
		error.message,
	);
}
