import { createServerFn } from "@tanstack/react-start";
import { getToken } from "~/lib/auth-server";

/**
 * Server function that checks whether the current request has a valid
 * Better Auth session.  Used by route `beforeLoad` guards to decide
 * whether to redirect.
 */
export const checkBetterAuthSession = createServerFn({
	method: "GET",
}).handler(async () => {
	try {
		const token = await getToken();
		return !!token;
	} catch {
		return false;
	}
});
