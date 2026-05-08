import type { AuthClient } from "@convex-dev/better-auth/react";
import { ConvexProviderWithAuth } from "convex/react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type ConvexAuthClient = Parameters<typeof ConvexProviderWithAuth>[0]["client"];
type CachedToken = {
	key: string;
	token: string;
};
type PendingToken = {
	key: string;
	promise: Promise<string | null>;
};

export function OrganizationAwareConvexAuthProvider({
	authClient,
	children,
	client,
}: {
	authClient: AuthClient;
	children: ReactNode;
	client: ConvexAuthClient;
}) {
	const useBetterAuth = useOrganizationAwareAuth(authClient);

	return (
		<ConvexProviderWithAuth client={client} useAuth={useBetterAuth}>
			{children}
		</ConvexProviderWithAuth>
	);
}

function useOrganizationAwareAuth(authClient: AuthClient) {
	return useMemo(
		() =>
			function useAuthFromBetterAuth() {
				const cachedTokenRef = useRef<CachedToken | null>(null);
				const pendingTokenRef = useRef<PendingToken | null>(null);
				const [hasCachedToken, setHasCachedToken] = useState(false);
				const { data: session, isPending: isSessionPending } =
					authClient.useSession();
				const authContextKey = [
					session?.session?.id ?? "",
					readString(session?.session, "activeOrganizationId") ?? "",
				].join(":");

				useEffect(() => {
					if (session || isSessionPending || !cachedTokenRef.current) return;
					cachedTokenRef.current = null;
					setHasCachedToken(false);
				}, [session, isSessionPending]);

				const fetchAccessToken = useCallback(
					async ({ forceRefreshToken = false } = {}) => {
						if (
							!forceRefreshToken &&
							cachedTokenRef.current?.key === authContextKey
						) {
							return cachedTokenRef.current.token;
						}

						if (
							!forceRefreshToken &&
							pendingTokenRef.current?.key === authContextKey
						) {
							return pendingTokenRef.current.promise;
						}

						const promise = authClient.convex
							.token({ fetchOptions: { throw: false } })
							.then(({ data }) => {
								const token = data?.token || null;
								cachedTokenRef.current = token
									? { key: authContextKey, token }
									: null;
								setHasCachedToken(Boolean(token));
								return token;
							})
							.catch(() => {
								cachedTokenRef.current = null;
								setHasCachedToken(false);
								return null;
							})
							.finally(() => {
								if (pendingTokenRef.current?.key === authContextKey) {
									pendingTokenRef.current = null;
								}
							});
						pendingTokenRef.current = { key: authContextKey, promise };
						return promise;
					},
					[authClient, authContextKey],
				);

				return useMemo(
					() => ({
						fetchAccessToken,
						isAuthenticated: Boolean(session?.session) || hasCachedToken,
						isLoading: isSessionPending && !hasCachedToken,
					}),
					[
						fetchAccessToken,
						hasCachedToken,
						isSessionPending,
						session?.session,
					],
				);
			},
		[authClient],
	);
}

function readString(value: unknown, key: string) {
	if (!value || typeof value !== "object") {
		return null;
	}

	const field = (value as Record<string, unknown>)[key];
	return typeof field === "string" ? field : null;
}
