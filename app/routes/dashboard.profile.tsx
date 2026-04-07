import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ProfileSettingsPage } from "~/components/profile/profile-settings-page";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/dashboard/profile")({
	component: DashboardProfileRoute,
});

function DashboardProfileRoute() {
	const user = useQuery(api.users.viewer);

	return <ProfileSettingsPage user={user} />;
}
