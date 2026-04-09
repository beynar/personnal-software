import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { authClient } from "~/lib/auth-client";
import { ensureOrganizationForSession } from "~/lib/organization";
import { PROJECT_NAME } from "~/lib/project";

export function PublicAuthCard({
	onAuthSuccess,
}: { onAuthSuccess?: () => void } = {}) {
	return (
		<Card className="w-full max-w-sm">
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">{PROJECT_NAME}</CardTitle>
				<CardDescription>
					Sign in to your account or create a new one
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="login">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="login">Login</TabsTrigger>
						<TabsTrigger value="signup">Create Account</TabsTrigger>
					</TabsList>
					<TabsContent value="login">
						<LoginForm onAuthSuccess={onAuthSuccess} />
					</TabsContent>
					<TabsContent value="signup">
						<SignUpForm onAuthSuccess={onAuthSuccess} />
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

function LoginForm({ onAuthSuccess }: { onAuthSuccess?: () => void }) {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError("");
		setLoading(true);
		const formData = new FormData(e.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;
		try {
			const { error: authError } = await authClient.signIn.email({
				email,
				password,
			});
			if (authError) {
				setError(authError.message ?? "Failed to sign in");
				return;
			}
			await ensureOrganizationForSession(authClient, { email });
			if (onAuthSuccess) {
				onAuthSuccess();
			} else {
				navigate({ to: "/dashboard" });
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to sign in");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="mt-4 space-y-4">
			<div className="space-y-2">
				<Label htmlFor="login-email">Email</Label>
				<Input
					id="login-email"
					name="email"
					type="email"
					placeholder="you@example.com"
					autoComplete="email"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="login-password">Password</Label>
				<Input
					id="login-password"
					name="password"
					type="password"
					autoComplete="current-password"
					required
				/>
			</div>
			{error && <p className="text-sm text-destructive">{error}</p>}
			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Signing in…" : "Sign In"}
			</Button>
		</form>
	);
}

function SignUpForm({ onAuthSuccess }: { onAuthSuccess?: () => void }) {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError("");
		const formData = new FormData(e.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;
		const confirmPassword = formData.get("confirmPassword") as string;
		const name = formData.get("name") as string;
		const superAdminPassword = formData.get("superAdminPassword") as string;

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setLoading(true);
		try {
			const { error: authError } = await authClient.signUp.email(
				{ email, password, name },
				{
					headers: {
						"x-super-admin-password": superAdminPassword,
					},
				},
			);
			if (authError) {
				setError(authError.message ?? "Failed to create account");
				return;
			}
			await ensureOrganizationForSession(authClient, { email, name });
			if (onAuthSuccess) {
				onAuthSuccess();
			} else {
				navigate({ to: "/dashboard" });
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create account");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="mt-4 space-y-4">
			<div className="space-y-2">
				<Label htmlFor="signup-name">Name</Label>
				<Input
					id="signup-name"
					name="name"
					type="text"
					placeholder="Ada Lovelace"
					autoComplete="name"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="signup-email">Email</Label>
				<Input
					id="signup-email"
					name="email"
					type="email"
					placeholder="you@example.com"
					autoComplete="email"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="signup-password">Password</Label>
				<Input
					id="signup-password"
					name="password"
					type="password"
					autoComplete="new-password"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="signup-confirm">Confirm Password</Label>
				<Input
					id="signup-confirm"
					name="confirmPassword"
					type="password"
					autoComplete="new-password"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="signup-super-admin-password">
					Super Admin Password
				</Label>
				<Input
					id="signup-super-admin-password"
					name="superAdminPassword"
					type="password"
					autoComplete="one-time-code"
					required
				/>
			</div>
			{error && <p className="text-sm text-destructive">{error}</p>}
			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Creating account…" : "Sign Up"}
			</Button>
		</form>
	);
}
