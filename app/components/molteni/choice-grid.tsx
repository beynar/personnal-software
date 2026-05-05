import type { LucideIcon } from "lucide-react";
import { Circle } from "lucide-react";

import { cn } from "~/lib/utils";

export type ChoiceOption<T extends string> = {
	description?: string;
	disabled?: boolean;
	icon?: LucideIcon;
	label: string;
	value: T;
};

export function ChoiceGrid<T extends string>({
	className,
	compact = false,
	onChange,
	options,
	value,
}: {
	className?: string;
	compact?: boolean;
	onChange: (value: T) => void;
	options: ChoiceOption<T>[];
	value: T | "";
}) {
	return (
		<div className={cn("grid gap-2", className)}>
			{options.map((option) => {
				const Icon = option.icon ?? Circle;
				const selected = option.value === value;
				return (
					<button
						aria-pressed={selected}
						className={cn(
							"group flex min-h-14 items-start gap-3 rounded-md border p-3 text-left transition-[background-color,border-color,box-shadow,color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
							selected
								? "border-primary bg-background text-foreground ring-2 ring-primary ring-offset-0"
								: "border-border bg-background hover:bg-accent",
							compact && "min-h-10 items-center px-3 py-2",
						)}
						disabled={option.disabled}
						key={option.value}
						onClick={() => onChange(option.value)}
						type="button"
					>
						<span
							className={cn(
								"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
								selected
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-muted text-muted-foreground group-hover:text-foreground",
								compact && "mt-0 size-7",
							)}
						>
							<Icon className="size-4" />
						</span>
						<span className="min-w-0">
							<span className="block font-medium text-sm leading-tight">
								{option.label}
							</span>
							{option.description ? (
								<span className="mt-1 block text-muted-foreground text-xs leading-snug">
									{option.description}
								</span>
							) : null}
						</span>
					</button>
				);
			})}
		</div>
	);
}
