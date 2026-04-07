import { ConvexAuthProvider } from "@convex-dev/auth/react";
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { PROJECT_NAME } from "~/lib/project";
import appCss from "../app.css?url";

const faviconHref = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#111827"/><path d="M20 16h14c8.837 0 16 7.163 16 16s-7.163 16-16 16H20z" fill="#f8fafc"/><path d="M30 28h6c4.418 0 8 3.582 8 8s-3.582 8-8 8h-6z" fill="#111827"/></svg>',
)}`;

function getConvexUrl() {
	const url = import.meta.env.VITE_CONVEX_URL;
	if (typeof url !== "string" || url.trim() === "") {
		return null;
	}

	try {
		new URL(url);
		return url.trim().replace(/\/+$/, "");
	} catch {
		return null;
	}
}

const convexUrl = getConvexUrl();
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: PROJECT_NAME },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: faviconHref },
		],
	}),
	component: RootComponent,
});

function RootComponent() {
	if (!convex) {
		return (
			<RootDocument>
				<MissingConvexConfig />
			</RootDocument>
		);
	}

	return (
		<ConvexAuthProvider client={convex}>
			<RootDocument>
				<Outlet />
			</RootDocument>
		</ConvexAuthProvider>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				<script>{`(() => {
  const savedTheme = window.localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : prefersDark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
})();`}</script>
			</head>
			<body className="min-h-screen antialiased">
				<TooltipProvider>
					{children}
					<Toaster richColors />
					<TanStackRouterDevtools />
					<Scripts />
				</TooltipProvider>
			</body>
		</html>
	);
}

function MissingConvexConfig() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
			<section className="w-full max-w-2xl rounded-3xl border bg-card p-8 shadow-sm">
				<p className="text-sm font-medium text-muted-foreground">
					Setup required
				</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight">
					Convex is not configured
				</h1>
				<p className="mt-4 text-base text-muted-foreground">
					The app can&apos;t connect to Convex until{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 text-sm">
						VITE_CONVEX_URL
					</code>{" "}
					is set to a valid absolute URL in{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 text-sm">
						.env.local
					</code>
					.
				</p>
				<div className="mt-6 rounded-2xl bg-secondary p-4">
					<p className="text-sm font-medium">Expected entries</p>
					<pre className="mt-3 overflow-x-auto text-sm text-secondary-foreground">
						{`CONVEX_DEPLOYMENT=dev:your-deployment-name
VITE_CONVEX_URL=https://your-deployment-name.convex.cloud`}
					</pre>
				</div>
				<p className="mt-6 text-sm text-muted-foreground">
					Run{" "}
					<code className="rounded bg-muted px-1.5 py-0.5">npx convex dev</code>{" "}
					to create a deployment and populate the env file, then refresh the
					page.
				</p>
			</section>
		</main>
	);
}
