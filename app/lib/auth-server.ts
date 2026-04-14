import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string;

const upstream = convexBetterAuthReactStart({
	convexUrl,
	convexSiteUrl,
});

export const getToken = upstream.getToken;

export const handler = async (request: Request): Promise<Response> => {
	try {
		const requestUrl = new URL(request.url);
		const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`;
		const headers = new Headers(request.headers);
		headers.delete("host");
		headers.delete("referer");
		headers.delete("content-length");
		headers.delete("transfer-encoding");

		const body =
			request.method === "GET" || request.method === "HEAD"
				? undefined
				: await request.arrayBuffer();

		return await fetch(nextUrl, {
			method: request.method,
			headers,
			redirect: "manual",
			body,
		});
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
