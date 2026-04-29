import { useRouterState } from "@tanstack/react-router";

import { cn } from "~/lib/utils";

export function NavigationProgress() {
	const isNavigating = useRouterState({
		select: (state) => state.status === "pending",
	});

	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-150",
				isNavigating ? "opacity-100" : "opacity-0",
			)}
		>
			<div className="navigation-progress-bar h-full w-2/3 rounded-full bg-primary" />
		</div>
	);
}
