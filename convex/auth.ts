import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [
		Password({
			profile(params) {
				const email = normalizeEmail(params.email);

				if (params.flow === "signUp") {
					const expectedPassword = process.env.SUPER_ADMIN_SIGNUP_PASSWORD;
					if (!expectedPassword) {
						throw new Error(
							"Missing SUPER_ADMIN_SIGNUP_PASSWORD environment variable",
						);
					}

					if (params.superAdminPassword !== expectedPassword) {
						throw new Error("Invalid super admin password");
					}
				}

				return { email };
			},
		}),
	],
});

function normalizeEmail(value: unknown) {
	if (typeof value !== "string") {
		throw new Error("Missing `email` param");
	}

	const email = value.trim().toLowerCase();
	if (!email) {
		throw new Error("Missing `email` param");
	}

	return email;
}
