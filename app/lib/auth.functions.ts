import { createServerFn } from "@tanstack/react-start";
import { updateSession } from "@tanstack/react-start/server";
import {
	clearAuthSession,
	getAuthSessionConfig,
	readAuthSession,
} from "~/lib/session.server";

type AuthSessionInput = {
	email: string;
};

export const getAuthSession = createServerFn({ method: "GET" }).handler(
	async () => {
		return await readAuthSession();
	},
);

export const syncAuthSession = createServerFn({ method: "POST" })
	.inputValidator((data: AuthSessionInput) => {
		const email = data.email.trim().toLowerCase();
		if (!email) {
			throw new Error("Missing email");
		}
		return { email };
	})
	.handler(async ({ data }) => {
		const issuedAt = Date.now();
		await updateSession(getAuthSessionConfig(), {
			email: data.email,
			issuedAt,
		});
		return { email: data.email, issuedAt };
	});

export const removeAuthSession = createServerFn({ method: "POST" }).handler(
	async () => {
		await clearAuthSession();
		return null;
	},
);
