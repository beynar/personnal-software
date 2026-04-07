import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string;

export const { getToken, handler, fetchAuthQuery, fetchAuthMutation } =
	convexBetterAuthReactStart({
		convexUrl,
		convexSiteUrl,
	});
