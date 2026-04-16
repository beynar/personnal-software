import type { StaticDataRouteOption } from "@tanstack/router-core";

export type DashboardPageHeader = {
	backHref?: string;
	description?: string;
	title: string;
};

declare module "@tanstack/router-core" {
	interface StaticDataRouteOption {
		dashboardHeader?: DashboardPageHeader;
	}
}

export function getDashboardPageHeader(
	matches: Array<{ staticData: StaticDataRouteOption }>,
): DashboardPageHeader | null {
	for (let index = matches.length - 1; index >= 0; index -= 1) {
		const header = matches[index]?.staticData.dashboardHeader;
		if (header) {
			return header;
		}
	}

	return null;
}
