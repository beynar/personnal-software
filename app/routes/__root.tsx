import { ConvexAuthProvider } from "@convex-dev/auth/react";
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ConvexReactClient } from "convex/react";
import appCss from "../app.css?url";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Bubbly Dragon" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootComponent,
});

function RootComponent() {
	return (
		<ConvexAuthProvider client={convex}>
			<RootDocument>
				<Outlet />
			</RootDocument>
		</ConvexAuthProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen antialiased">
				{children}
				<TanStackRouterDevtools />
				<Scripts />
			</body>
		</html>
	);
}
