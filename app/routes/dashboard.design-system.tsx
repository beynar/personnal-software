import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowRight,
	Home,
	Layers3,
	LayoutPanelLeft,
	Sparkles,
} from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
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
} from "~/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export const Route = createFileRoute("/dashboard/design-system")({
	component: DesignSystemPage,
});

function DesignSystemPage() {
	return (
		<div className="space-y-6">
			<Card className="overflow-hidden border-border/70">
				<CardHeader className="gap-3 border-b border-border/70 bg-card/70">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<Layers3 className="size-4" />
						Design system
					</div>
					<CardTitle className="text-3xl">
						Current primitives available in the template
					</CardTitle>
					<CardDescription className="max-w-2xl text-sm leading-6">
						This page renders the components that ship in the starter so an
						agent or a human can see what is already present before building new
						UI.
					</CardDescription>
				</CardHeader>
			</Card>
			<div className="grid gap-4 xl:grid-cols-2">
				<ButtonShowcase />
				<FormShowcase />
				<TabsShowcase />
				<CardShowcase />
				<SeparatorShowcase />
				<SheetShowcase />
				<AccordionShowcase />
				<DialogShowcase />
				<PopoverShowcase />
				<SidebarShowcase />
			</div>
			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>Sidebar shell</CardTitle>
					<CardDescription>
						The dashboard itself is the sidebar example. The navigation stays
						mounted while you move between nested pages like this one.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-4">
						<div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
							<LayoutPanelLeft className="size-4" />
						</div>
						<div>
							<p className="font-medium">Persistent navigation shell</p>
							<p className="text-sm text-muted-foreground">
								Collapsible sidebar, nested dashboard routes, and a stable
								content inset.
							</p>
						</div>
						<div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
							<ArrowRight className="size-4" />
							In use now
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function ButtonShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Buttons</CardTitle>
				<CardDescription>
					Default actions, secondary actions, and icon sizing.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap items-center gap-3">
				<Button>Primary</Button>
				<Button variant="secondary">Secondary</Button>
				<Button variant="outline">Outline</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="link">Link</Button>
				<Button size="icon" variant="outline">
					<Sparkles className="size-4" />
				</Button>
			</CardContent>
		</Card>
	);
}

function FormShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Inputs and labels</CardTitle>
				<CardDescription>
					Core form controls already available to the app.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="showcase-name">Project name</Label>
					<Input id="showcase-name" placeholder="Bubbly Dragon" />
				</div>
				<div className="space-y-2">
					<Label htmlFor="showcase-email">Contact email</Label>
					<Input
						id="showcase-email"
						placeholder="operator@example.com"
						type="email"
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function TabsShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Tabs</CardTitle>
				<CardDescription>
					Segmented content for compact settings or dashboards.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="overview">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="states">States</TabsTrigger>
						<TabsTrigger value="notes">Notes</TabsTrigger>
					</TabsList>
					<TabsContent
						className="rounded-xl border border-border/70 bg-background/70 p-4"
						value="overview"
					>
						<p className="text-sm text-muted-foreground">
							Tabs are already wired and styled for compact page sections.
						</p>
					</TabsContent>
					<TabsContent
						className="rounded-xl border border-border/70 bg-background/70 p-4"
						value="states"
					>
						<p className="text-sm text-muted-foreground">
							They work well for settings, account areas, and comparison views.
						</p>
					</TabsContent>
					<TabsContent
						className="rounded-xl border border-border/70 bg-background/70 p-4"
						value="notes"
					>
						<p className="text-sm text-muted-foreground">
							This template uses the new-york shadcn style with Tailwind v4
							tokens.
						</p>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

function CardShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Cards</CardTitle>
				<CardDescription>
					Framed content areas for stats, settings, or grouped actions.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 sm:grid-cols-2">
				<div className="rounded-2xl border border-border/70 bg-background/70 p-4">
					<p className="font-medium">Compact panel</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Useful for a simple metric or note.
					</p>
				</div>
				<div className="rounded-2xl border border-border/70 bg-accent/35 p-4">
					<p className="font-medium">Highlighted panel</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Same primitive, different tone and emphasis.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

function SeparatorShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Separators</CardTitle>
				<CardDescription>
					Horizontal and vertical dividers for dense compositions.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-4">
					<p className="font-medium">Section one</p>
					<Separator />
					<p className="text-sm text-muted-foreground">
						Horizontal separators are useful between stacked blocks.
					</p>
				</div>
				<div className="flex h-16 items-center justify-center gap-4 rounded-xl border border-border/70 bg-background/70 p-4">
					<span className="text-sm">Left</span>
					<Separator orientation="vertical" />
					<span className="text-sm">Right</span>
				</div>
			</CardContent>
		</Card>
	);
}

function SheetShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Sheets</CardTitle>
				<CardDescription>
					Slide-over panels for mobile navigation or focused side tasks.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Sheet>
					<SheetTrigger asChild>
						<Button variant="outline">Open sample sheet</Button>
					</SheetTrigger>
					<SheetContent>
						<SheetHeader>
							<SheetTitle>Sheet primitive</SheetTitle>
							<SheetDescription>
								This is the same primitive used by the dashboard sidebar on
								mobile.
							</SheetDescription>
						</SheetHeader>
						<div className="px-4 pb-4 text-sm text-muted-foreground">
							The template can now open side panels without adding another UI
							kit.
						</div>
					</SheetContent>
				</Sheet>
			</CardContent>
		</Card>
	);
}

function AccordionShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Accordion</CardTitle>
				<CardDescription>
					Uses the default open and close height animation.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Accordion className="w-full" collapsible type="single">
					<AccordionItem value="item-1">
						<AccordionTrigger>What is animated here?</AccordionTrigger>
						<AccordionContent>
							The content expands and collapses with the standard accordion
							transition instead of snapping open.
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="item-2">
						<AccordionTrigger>Why keep it local?</AccordionTrigger>
						<AccordionContent>
							So future screens can reuse the same motion without rewriting the
							wrapper.
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</CardContent>
		</Card>
	);
}

function DialogShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Dialog</CardTitle>
				<CardDescription>
					Fades and zooms in with the standard shadcn modal motion.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Dialog>
					<DialogTrigger asChild>
						<Button variant="outline">Open dialog</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Confirm dashboard action</DialogTitle>
							<DialogDescription>
								This dialog uses the default animated overlay and centered entry
								transition.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="ghost">Cancel</Button>
							<Button>Continue</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}

function PopoverShowcase() {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Popover</CardTitle>
				<CardDescription>
					Uses the standard fade, zoom, and side-aware slide transition.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline">Open popover</Button>
					</PopoverTrigger>
					<PopoverContent>
						<p className="font-medium">Popover motion</p>
						<p className="mt-1 text-sm text-muted-foreground">
							This panel animates from the side it opens from instead of simply
							appearing.
						</p>
					</PopoverContent>
				</Popover>
			</CardContent>
		</Card>
	);
}

function SidebarShowcase() {
	return (
		<Card className="border-border/70 xl:col-span-2">
			<CardHeader>
				<CardTitle>Sidebar primitives</CardTitle>
				<CardDescription>
					The full sidebar system is part of the design system too, not just the
					page shell around this view.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<SidebarProvider className="h-80 overflow-hidden rounded-2xl border border-border/70">
					<Sidebar className="md:flex">
						<SidebarHeader>
							<div className="flex items-center gap-3 rounded-2xl bg-sidebar-primary px-3 py-3 text-sidebar-primary-foreground">
								<div className="flex size-10 items-center justify-center rounded-xl bg-white/12">
									<LayoutPanelLeft className="size-4" />
								</div>
								<div>
									<p className="text-sm font-semibold">Sidebar</p>
									<p className="text-xs text-sidebar-primary-foreground/70">
										Provider, menu, trigger
									</p>
								</div>
							</div>
						</SidebarHeader>
						<SidebarContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton asChild isActive>
										<a href="#sidebar-home">
											<Home className="size-4 shrink-0" />
											<span>Home item</span>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton asChild>
										<a href="#sidebar-design">
											<Layers3 className="size-4 shrink-0" />
											<span>Design system item</span>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarContent>
						<SidebarFooter>
							<Button className="w-full justify-start" variant="outline">
								<Sparkles className="size-4" />
								<span>Footer action</span>
							</Button>
						</SidebarFooter>
					</Sidebar>
					<SidebarInset className="min-h-0">
						<div className="flex items-center gap-3 border-b border-border/70 bg-background/95 px-4 py-4">
							<SidebarTrigger />
							<div>
								<p className="text-sm font-medium">Inset content</p>
								<p className="text-sm text-muted-foreground">
									Sidebar and inset compose into one workspace.
								</p>
							</div>
						</div>
						<div className="grid flex-1 place-items-center bg-background px-4 py-6 text-center">
							<div className="max-w-sm space-y-2">
								<p className="font-medium">
									This preview uses the actual sidebar components.
								</p>
								<p className="text-sm text-muted-foreground">
									It exercises `SidebarProvider`, `Sidebar`, `SidebarHeader`,
									`SidebarContent`, `SidebarFooter`, `SidebarMenu`,
									`SidebarMenuItem`, `SidebarMenuButton`, `SidebarInset`, and
									`SidebarTrigger`.
								</p>
							</div>
						</div>
					</SidebarInset>
				</SidebarProvider>
			</CardContent>
		</Card>
	);
}
