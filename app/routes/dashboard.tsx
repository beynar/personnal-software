import {
	Link,
	Outlet,
	createFileRoute,
	redirect,
	useLocation,
	useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	Building2,
	Home,
	Key,
	Layers3,
	LogOut,
	Moon,
	Sun,
	UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
} from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import { authClient } from "~/lib/auth-client";
import { checkBetterAuthSession } from "~/lib/auth.functions";
import { PROJECT_INITIALS, PROJECT_NAME } from "~/lib/project";
import { api } from "../../convex/_generated/api";

const dashboardLinks = [
	{ to: "/dashboard", label: "Overview", icon: Home },
	{
		to: "/dashboard/organizations",
		label: "Organizations",
		icon: Building2,
	},
	{ to: "/dashboard/api-keys", label: "API Keys", icon: Key },
	{ to: "/dashboard/design-system", label: "Design System", icon: Layers3 },
] as const;

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async () => {
		const isAuthenticated = await checkBetterAuthSession();
		if (!isAuthenticated) {
			throw redirect({ to: "/" });
		}
	},
	component: DashboardLayoutRoute,
});

function DashboardLayoutRoute() {
	return <DashboardShell />;
}

function DashboardShell() {
	const user = useQuery(api.users.viewer);
	const navigate = useNavigate();
	const { pathname } = useLocation();

	async function handleSignOut() {
		await authClient.signOut();
		navigate({ to: "/" });
	}

	return (
		<SidebarProvider className="min-h-screen">
			<Sidebar>
				<SidebarHeader className="px-4 py-4 sm:px-6">
					<BrandBlock />
				</SidebarHeader>
				<SidebarContent>
					<SidebarMenu>
						{dashboardLinks.map((link) => (
							<SidebarMenuItem key={link.to}>
								<SidebarMenuButton
									asChild
									isActive={isActiveLink(pathname, link.to)}
								>
									<Link to={link.to}>
										<link.icon className="size-4 shrink-0" />
										<SidebarLabel>{link.label}</SidebarLabel>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarContent>
				<DashboardSidebarFooter onSignOut={handleSignOut} user={user} />
			</Sidebar>
			<SidebarInset>
				<header className="sticky top-0 z-10 border-b border-border/70 bg-background/95 backdrop-blur">
					<div className="flex items-center gap-3 px-4 py-4 sm:px-6">
						<SidebarTrigger />
						<div className="min-w-0">
							<p className="text-sm font-medium text-foreground">Dashboard</p>
							<p className="truncate text-sm text-muted-foreground">
								Starter workspace with a persistent shell and nested pages
							</p>
						</div>
					</div>
				</header>
				<div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

function BrandBlock() {
	const { isCollapsed, isMobile } = useSidebar();

	return (
		<p className="truncate text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
			{isCollapsed && !isMobile ? PROJECT_INITIALS : PROJECT_NAME}
		</p>
	);
}

function SessionFooter({
	user,
	onSignOut,
}: {
	user:
		| {
				email?: string;
				image?: string | null;
				name?: string;
		  }
		| null
		| undefined;
	onSignOut: () => Promise<void>;
}) {
	if (user === undefined) {
		return <SessionFooterSkeleton />;
	}

	const userLabel = user?.name ?? user?.email ?? "Signed in";

	return (
		<div className="rounded-xl border border-border/70 bg-background/80 p-3">
			<div className="flex items-center gap-3">
				<Avatar className="size-10 border border-border/70" size="lg">
					<AvatarImage alt={userLabel} src={user?.image ?? undefined} />
					<AvatarFallback>{getInitials(userLabel)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{userLabel}</p>
					<p className="truncate text-xs text-muted-foreground">
						{user?.email ?? "Account"}
					</p>
				</div>
			</div>
			<div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
				<Button
					className="size-9 p-0"
					onClick={onSignOut}
					type="button"
					variant="outline"
				>
					<LogOut className="size-4" />
					<span className="sr-only">Sign out</span>
				</Button>
				<Button asChild className="justify-start" variant="outline">
					<Link to="/dashboard/profile">
						<UserRound className="size-4" />
						<span>Profile</span>
					</Link>
				</Button>
			</div>
		</div>
	);
}

function SessionFooterSkeleton() {
	return (
		<div className="rounded-xl border border-border/70 bg-background/80 p-3">
			<div className="flex items-center gap-3">
				<Skeleton className="size-10 shrink-0 rounded-full" />
				<div className="min-w-0 flex-1 space-y-2">
					<Skeleton className="h-4 w-28 rounded-md" />
					<Skeleton className="h-3 w-36 rounded-md" />
				</div>
			</div>
			<div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
				<Skeleton className="size-9 rounded-md" />
				<Skeleton className="h-9 w-full rounded-md" />
			</div>
		</div>
	);
}

function DashboardSidebarFooter({
	user,
	onSignOut,
}: {
	user:
		| {
				email?: string;
				image?: string | null;
				name?: string;
		  }
		| null
		| undefined;
	onSignOut: () => Promise<void>;
}) {
	const { isCollapsed, isMobile } = useSidebar();

	if (isCollapsed && !isMobile) {
		return (
			<SidebarFooter className="p-0">
				<ThemeToggle
					className="m-0 h-16 w-full rounded-none border-b border-border-70"
					size="icon"
					variant="ghost"
				/>
				<Button
					asChild
					className="m-0 h-16 w-full rounded-none border-b border-border-70"
					size="icon"
					variant="ghost"
				>
					<Link to="/dashboard/profile">
						<UserRound className="size-5" />
						<span className="sr-only">Profile</span>
					</Link>
				</Button>
				<Button
					className="m-0 h-16 w-full rounded-none border-0"
					onClick={onSignOut}
					size="icon"
					variant="ghost"
				>
					<LogOut className="size-5" />
					<span className="sr-only">Sign out</span>
				</Button>
			</SidebarFooter>
		);
	}

	return (
		<SidebarFooter className="gap-4 flex flex-col">
			<ThemeToggle />
			<SessionFooter onSignOut={onSignOut} user={user} />
		</SidebarFooter>
	);
}

function ThemeToggle({
	className,
	size = "default",
	variant = "outline",
}: Pick<
	React.ComponentProps<typeof Button>,
	"className" | "size" | "variant"
>) {
	const { isCollapsed, isMobile } = useSidebar();
	const [theme, setTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		const root = document.documentElement;
		setTheme(root.classList.contains("dark") ? "dark" : "light");
	}, []);

	function toggleTheme() {
		const nextTheme = theme === "dark" ? "light" : "dark";
		document.documentElement.classList.toggle("dark", nextTheme === "dark");
		window.localStorage.setItem("theme", nextTheme);
		setTheme(nextTheme);
	}

	const Icon = theme === "dark" ? Sun : Moon;
	const label = theme === "dark" ? "Light mode" : "Dark mode";

	if (!isCollapsed || isMobile) {
		return (
			<div
				className={`flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5 ${className ?? ""}`}
			>
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
						<Icon className="size-4" />
					</div>
					<div className="min-w-0" id="theme-toggle-label">
						<p className="text-sm font-medium">Dark mode</p>
					</div>
				</div>
				<Switch
					aria-labelledby="theme-toggle-label"
					checked={theme === "dark"}
					onCheckedChange={(checked) => {
						const nextTheme = checked ? "dark" : "light";
						document.documentElement.classList.toggle("dark", checked);
						window.localStorage.setItem("theme", nextTheme);
						setTheme(nextTheme);
					}}
				/>
			</div>
		);
	}

	return (
		<Button
			className={className}
			onClick={toggleTheme}
			size={size}
			variant={variant}
		>
			<Icon className="size-4" />
			{isCollapsed && !isMobile ? (
				<span className="sr-only">{label}</span>
			) : (
				<span>{label}</span>
			)}
		</Button>
	);
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
	const { isCollapsed, isMobile } = useSidebar();

	return isCollapsed && !isMobile ? null : <span>{children}</span>;
}

function getInitials(value: string | undefined) {
	if (!value) {
		return "U";
	}

	const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

	if (!parts.length) {
		return "U";
	}

	return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function isActiveLink(pathname: string, to: string) {
	if (to === "/dashboard") {
		return pathname === "/dashboard" || pathname === "/dashboard/";
	}

	return pathname === to || pathname.startsWith(`${to}/`);
}
