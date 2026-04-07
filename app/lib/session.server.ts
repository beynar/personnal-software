import { env } from "cloudflare:workers";
import { clearSession, getSession } from "@tanstack/react-start/server";

const authSessionCookieName = "bd_auth";
const authSessionMaxAge = 60 * 60 * 24 * 7;

export type AuthSessionData = {
	email: string;
	issuedAt: number;
};

export function getAuthSessionConfig() {
	const password = env.AUTH_SESSION_SECRET;
	if (!password) {
		throw new Error("Missing AUTH_SESSION_SECRET environment variable");
	}

	return {
		password,
		name: authSessionCookieName,
		maxAge: authSessionMaxAge,
		cookie: {
			httpOnly: true,
			path: "/",
			sameSite: "lax" as const,
			secure: process.env.NODE_ENV === "production",
		},
	};
}

export async function readAuthSession() {
	const session = await getSession<AuthSessionData>(getAuthSessionConfig());
	const { email, issuedAt } = session.data;

	if (typeof email !== "string" || typeof issuedAt !== "number") {
		return null;
	}

	return { email, issuedAt };
}

export async function clearAuthSession() {
	await clearSession({
		name: authSessionCookieName,
	});
}
