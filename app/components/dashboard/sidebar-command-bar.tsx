import { useNavigate } from "@tanstack/react-router";
import {
	Building2,
	Command,
	Copy,
	Home,
	Layers3,
	LogOut,
	Moon,
	Sun,
	UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { useSidebar } from "~/components/ui/sidebar";
import { authClient } from "~/lib/auth-client";

type DashboardSidebarCommandBarProps = {
	onCopyMcpUrl: () => Promise<void>;
	onSignOut: () => Promise<void>;
	onThemeChange: (theme: "light" | "dark") => void;
	theme: "light" | "dark";
};

export function DashboardSidebarCommandBar({
	onCopyMcpUrl,
	onSignOut,
	onThemeChange,
	theme,
}: DashboardSidebarCommandBarProps) {
	const navigate = useNavigate();
	const { isCollapsed, isMobile } = useSidebar();
	const { data: activeOrganization } = authClient.useActiveOrganization();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (
				!(event.metaKey || event.ctrlKey) ||
				event.key.toLowerCase() !== "k"
			) {
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
			setOpen(true);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	if (isCollapsed && !isMobile) {
		return (
			<>
				<Button
					className="m-0 h-16 w-full rounded-none border-b border-border/70"
					onClick={() => setOpen(true)}
					size="icon"
					type="button"
					variant="ghost"
				>
					<Command className="size-4" />
					<span className="sr-only">Search commands</span>
				</Button>
				<DashboardCommandDialog
					activeOrganization={activeOrganization}
					onCopyMcpUrl={onCopyMcpUrl}
					onOpenChange={setOpen}
					onSignOut={onSignOut}
					onThemeChange={onThemeChange}
					open={open}
					theme={theme}
				/>
			</>
		);
	}

	return (
		<>
			<Button
				className="h-10 w-full justify-between rounded-xl border-border/70 px-3 text-muted-foreground"
				onClick={() => setOpen(true)}
				type="button"
				variant="outline"
			>
				<span className="flex items-center gap-2">
					<Command className="size-4" />
					<span className="text-sm">Search commands</span>
				</span>
				<CommandShortcut className="ml-3 inline-flex">⌘K</CommandShortcut>
			</Button>
			<DashboardCommandDialog
				activeOrganization={activeOrganization}
				onCopyMcpUrl={onCopyMcpUrl}
				onOpenChange={setOpen}
				onSignOut={onSignOut}
				onThemeChange={onThemeChange}
				open={open}
				theme={theme}
			/>
		</>
	);
}

function DashboardCommandDialog({
	activeOrganization,
	onCopyMcpUrl,
	onOpenChange,
	onSignOut,
	onThemeChange,
	open,
	theme,
}: {
	activeOrganization: { id: string } | null | undefined;
	onCopyMcpUrl: () => Promise<void>;
	onOpenChange: (open: boolean) => void;
	onSignOut: () => Promise<void>;
	onThemeChange: (theme: "light" | "dark") => void;
	open: boolean;
	theme: "light" | "dark";
}) {
	const navigate = useNavigate();

	return (
		<CommandDialog
			description="Search navigation and workspace actions."
			onOpenChange={onOpenChange}
			open={open}
			title="Dashboard commands"
		>
			<CommandInput placeholder="Search commands..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				<CommandGroup heading="Navigation">
					<CommandItem
						onSelect={() => {
							onOpenChange(false);
							void navigate({ to: "/dashboard" });
						}}
					>
						<Home className="size-4" />
						Overview
					</CommandItem>
					<CommandItem
						onSelect={() => {
							onOpenChange(false);
							void navigate({ to: "/dashboard/design-system" });
						}}
					>
						<Layers3 className="size-4" />
						Design System
					</CommandItem>
					<CommandItem
						onSelect={() => {
							onOpenChange(false);
							void navigate({ to: "/dashboard/profile" });
						}}
					>
						<UserRound className="size-4" />
						Profile
					</CommandItem>
					{activeOrganization ? (
						<CommandItem
							onSelect={() => {
								onOpenChange(false);
								void navigate({ to: "/dashboard/organization-settings" });
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
								onOpenChange(false);
								onThemeChange("light");
							}}
						>
							<Sun className="size-4" />
							Light mode
						</CommandItem>
					) : (
						<CommandItem
							onSelect={() => {
								onOpenChange(false);
								onThemeChange("dark");
							}}
						>
							<Moon className="size-4" />
							Dark mode
						</CommandItem>
					)}
					<CommandItem
						onSelect={() => {
							onOpenChange(false);
							void onCopyMcpUrl();
						}}
					>
						<Copy className="size-4" />
						Copy MCP URL
					</CommandItem>
					<CommandItem
						onSelect={() => {
							onOpenChange(false);
							void onSignOut();
						}}
					>
						<LogOut className="size-4" />
						Sign out
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
