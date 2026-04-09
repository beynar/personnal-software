import {
	Link,
	Outlet,
	createFileRoute,
	redirect,
	useLocation,
	useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	BookOpen,
	Building2,
	ChevronsUpDown,
	Command,
	Copy,
	Home,
	Key,
	Layers3,
	LogOut,
	Mail,
	Moon,
	Sun,
	UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiKeyDrawer } from "~/components/api-keys/api-key-drawer";
import { OrganizationSwitcher } from "~/components/organizations/organization-switcher";
import { PendingInvitationsDrawer } from "~/components/organizations/pending-invitations-drawer";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "~/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { ensureOrganizationForSession } from "~/lib/organization";
import { PROJECT_NAME } from "~/lib/project";
import { api } from "../../convex/_generated/api";

const dashboardLinks = [
	{ to: "/dashboard", label: "Overview", icon: Home },
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
	const syncViewerProfile = useMutation(api.users.syncViewerProfile);
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const [commandOpen, setCommandOpen] = useState(false);
	const [theme, setTheme] = useState<"light" | "dark">("light");
	const { data: activeOrganization, isPending: loadingActiveOrganization } =
		authClient.useActiveOrganization();
	const { data: organizations, isPending: loadingOrganizations } =
		authClient.useListOrganizations();

	useEffect(() => {
		if (!user?._id) return;
		if (loadingActiveOrganization || loadingOrganizations) return;
		void ensureOrganizationForSession(
			authClient,
			{ email: user.email, name: user.name },
			{
				activeOrganization: activeOrganization?.id
					? { id: activeOrganization.id }
					: null,
				organizations:
					organizations?.map((organization) => ({
						id: organization.id,
						name: organization.name,
					})) ?? null,
			},
		);
	}, [
		activeOrganization?.id,
		loadingActiveOrganization,
		loadingOrganizations,
		organizations,
		user?._id,
		user?.email,
		user?.name,
	]);

	useEffect(() => {
		if (!user?._id) return;
		void syncViewerProfile();
	}, [syncViewerProfile, user?._id]);

	useEffect(() => {
		const root = document.documentElement;
		setTheme(root.classList.contains("dark") ? "dark" : "light");
	}, []);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
				return;
			}

			const target = event.target;
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					target instanceof HTMLInputElement ||
					target instanceof HTMLTextAreaElement ||
					target instanceof HTMLSelectElement)
			) {
				return;
			}

			event.preventDefault();
			setCommandOpen(true);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	async function handleSignOut() {
		await authClient.signOut();
		navigate({ to: "/" });
	}

	async function handleCopyMcpUrl() {
		const mcpUrl = `${window.location.origin}/api/mcp`;

		try {
			await navigator.clipboard.writeText(mcpUrl);
			toast.success("MCP URL copied");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to copy MCP URL",
			);
		}
	}

	function applyTheme(nextTheme: "light" | "dark") {
		document.documentElement.classList.toggle("dark", nextTheme === "dark");
		window.localStorage.setItem("theme", nextTheme);
		setTheme(nextTheme);
	}

	return (
		<SidebarProvider className="min-h-screen">
			<Sidebar>
				<SidebarHeader className="px-4 py-3 sm:px-3 h-18">
					<DashboardSidebarOrganizationSwitcher />
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
				<header className="sticky top-0 z-10 border-b border-border/70 bg-background/95 backdrop-blur h-18">
					<div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
						<div className="flex items-center gap-3">
						<SidebarTrigger />
							<div className="min-w-0">
								<p className="text-sm font-medium text-foreground">Dashboard</p>
								<p className="truncate text-sm text-muted-foreground">
									Starter workspace with a persistent shell and nested pages
								</p>
							</div>
						</div>
						<Button
							className="h-10 min-w-[13rem] justify-between rounded-xl border-border/70 px-3 text-muted-foreground"
							onClick={() => setCommandOpen(true)}
							type="button"
							variant="outline"
						>
							<span className="flex items-center gap-2">
								<Command className="size-4" />
								<span className="text-sm">Search commands</span>
							</span>
							<CommandShortcut className="ml-3 hidden sm:inline-flex">
								⌘K
							</CommandShortcut>
						</Button>
						<CommandDialog
							description="Search navigation and workspace actions."
							onOpenChange={setCommandOpen}
							open={commandOpen}
							title="Dashboard commands"
						>
							<CommandInput placeholder="Search commands..." />
							<CommandList>
								<CommandEmpty>No results found.</CommandEmpty>
								<CommandGroup heading="Navigation">
									<CommandItem
										onSelect={() => {
											setCommandOpen(false);
											void navigate({ to: "/dashboard" });
										}}
									>
										<Home className="size-4" />
										Overview
									</CommandItem>
									<CommandItem
										onSelect={() => {
											setCommandOpen(false);
											void navigate({ to: "/dashboard/design-system" });
										}}
									>
										<Layers3 className="size-4" />
										Design System
									</CommandItem>
									<CommandItem
										onSelect={() => {
											setCommandOpen(false);
											void navigate({ to: "/dashboard/profile" });
										}}
									>
										<UserRound className="size-4" />
										Profile
									</CommandItem>
									{activeOrganization ? (
										<CommandItem
											onSelect={() => {
												setCommandOpen(false);
												void navigate({
													to: "/dashboard/organization-settings",
												});
											}}
										>
											<Building2 className="size-4" />
											Organization settings
										</CommandItem>
									) : null}
								</CommandGroup>
								<CommandSeparator />
								<CommandGroup heading="Actions">
									{theme === "dark" ? (
										<CommandItem
											onSelect={() => {
												setCommandOpen(false);
												applyTheme("light");
											}}
										>
											<Sun className="size-4" />
											Light mode
										</CommandItem>
									) : (
										<CommandItem
											onSelect={() => {
												setCommandOpen(false);
												applyTheme("dark");
											}}
										>
											<Moon className="size-4" />
											Dark mode
										</CommandItem>
									)}
									<CommandItem
										onSelect={() => {
											setCommandOpen(false);
											void handleCopyMcpUrl();
										}}
									>
										<Copy className="size-4" />
										Copy MCP URL
									</CommandItem>
									<CommandItem
										onSelect={() => {
											setCommandOpen(false);
											void handleSignOut();
										}}
									>
										<LogOut className="size-4" />
										Sign out
									</CommandItem>
								</CommandGroup>
							</CommandList>
						</CommandDialog>
					</div>
				</header>
				<div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

function DashboardSidebarOrganizationSwitcher() {
	const { isCollapsed } = useSidebar();

	return <OrganizationSwitcher isCollapsed={isCollapsed} />;
}

function SessionFooter({
	activeOrganization,
	onCopyMcpUrl,
	onSignOut,
	user,
}: {
	activeOrganization: { id: string } | null | undefined;
	onCopyMcpUrl: () => Promise<void>;
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
	const [apiKeyDrawerOpen, setApiKeyDrawerOpen] = useState(false);
	const [pendingInvitationsDrawerOpen, setPendingInvitationsDrawerOpen] =
		useState(false);

	if (user === undefined) {
		return <SessionFooterSkeleton />;
	}

	const userLabel = user?.name ?? user?.email ?? "Signed in";

	return (
		<>
			<ApiKeyDrawer
				onOpenChange={setApiKeyDrawerOpen}
				open={apiKeyDrawerOpen}
				showTrigger={false}
			/>
			<PendingInvitationsDrawer
				onOpenChange={setPendingInvitationsDrawerOpen}
				open={pendingInvitationsDrawerOpen}
				showTrigger={false}
			/>
			<div className="rounded-xl border border-border/70 bg-background/80">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-auto w-full justify-between rounded-lg px-2 py-2.5"
							variant="ghost"
						>
							<div className="flex min-w-0 items-center gap-3 text-left">
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
							<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-56" side="right">
						<AccountMenuItems
							activeOrganization={activeOrganization}
							onCopyMcpUrl={onCopyMcpUrl}
							onOpenApiKeys={() => setApiKeyDrawerOpen(true)}
							onOpenPendingInvitations={() =>
								setPendingInvitationsDrawerOpen(true)
							}
							onSignOut={onSignOut}
						/>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</>
	);
}

function AccountMenuItems({
	activeOrganization,
	onCopyMcpUrl,
	onOpenApiKeys,
	onOpenPendingInvitations,
	onSignOut,
}: {
	activeOrganization: { id: string } | null | undefined;
	onCopyMcpUrl: () => Promise<void>;
	onOpenApiKeys: () => void;
	onOpenPendingInvitations: () => void;
	onSignOut: () => Promise<void>;
}) {
	return (
		<>
			<DropdownMenuItem asChild>
				<a href="/api/v1/docs">
					<BookOpen className="size-4" />
					<span>API reference</span>
				</a>
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={onOpenApiKeys}>
				<Key className="size-4" />
				<span>API keys</span>
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={onOpenPendingInvitations}>
				<Mail className="size-4" />
				<span>Pending invites</span>
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => void onCopyMcpUrl()}>
				<Copy className="size-4" />
				<span>Copy MCP URL</span>
			</DropdownMenuItem>
			{activeOrganization ? (
				<DropdownMenuItem asChild>
					<Link to="/dashboard/organization-settings">
						<Building2 className="size-4" />
						<span>Organization settings</span>
					</Link>
				</DropdownMenuItem>
			) : null}
			<DropdownMenuItem asChild>
				<Link to="/dashboard/profile">
					<UserRound className="size-4" />
					<span>Profile</span>
				</Link>
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem onSelect={() => void onSignOut()} variant="destructive">
				<LogOut className="size-4" />
				<span>Sign out</span>
			</DropdownMenuItem>
		</>
	);
}

function SessionFooterSkeleton() {
	return (
		<div className="rounded-xl border border-border/70 bg-background/80">
			<div className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5">
				<div className="flex min-w-0 items-center gap-3">
					<Skeleton className="size-10 shrink-0 rounded-full" />
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-4 w-28 rounded-md" />
						<Skeleton className="h-3 w-36 rounded-md" />
					</div>
				</div>
				<Skeleton className="size-4 shrink-0 rounded-sm" />
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
	const { data: activeOrganization } = authClient.useActiveOrganization();
	const { isCollapsed, isMobile } = useSidebar();
	const [apiKeyDrawerOpen, setApiKeyDrawerOpen] = useState(false);
	const [pendingInvitationsDrawerOpen, setPendingInvitationsDrawerOpen] =
		useState(false);
	const userLabel = user?.name ?? user?.email ?? "Signed in";

	async function handleCopyMcpUrl() {
		const mcpUrl = `${window.location.origin}/api/mcp`;

		try {
			await navigator.clipboard.writeText(mcpUrl);
			toast.success("MCP URL copied");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to copy MCP URL",
			);
		}
	}

	if (isCollapsed && !isMobile) {
		return (
			<SidebarFooter className="p-0">
				<ApiKeyDrawer
					onOpenChange={setApiKeyDrawerOpen}
					open={apiKeyDrawerOpen}
					showTrigger={false}
				/>
				<PendingInvitationsDrawer
					onOpenChange={setPendingInvitationsDrawerOpen}
					open={pendingInvitationsDrawerOpen}
					showTrigger={false}
				/>
				<ThemeToggle
					className="m-0 h-16 w-full rounded-none border-b border-border-70"
					size="icon"
					variant="ghost"
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="m-0 h-16 w-full rounded-none border-0"
							size="icon"
							variant="ghost"
						>
							<Avatar className="size-9 border border-border/70" size="lg">
								<AvatarImage alt={userLabel} src={user?.image ?? undefined} />
								<AvatarFallback>{getInitials(userLabel)}</AvatarFallback>
							</Avatar>
							<span className="sr-only">Open account menu</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" side="right">
						<AccountMenuItems
							activeOrganization={activeOrganization}
							onCopyMcpUrl={handleCopyMcpUrl}
							onOpenApiKeys={() => setApiKeyDrawerOpen(true)}
							onOpenPendingInvitations={() =>
								setPendingInvitationsDrawerOpen(true)
							}
							onSignOut={onSignOut}
						/>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarFooter>
		);
	}

	return (
		<SidebarFooter className="gap-4 flex flex-col">
			<ThemeToggle />
			<SessionFooter
				activeOrganization={activeOrganization}
				onCopyMcpUrl={handleCopyMcpUrl}
				onSignOut={onSignOut}
				user={user}
			/>
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
