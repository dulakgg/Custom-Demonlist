"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { ROUTES } from "@/lib/routes";

export default function LoginPage() {
	const { data: session, status } = useSession();

	if (status === "loading") {
		return (
			<main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 text-center">
				<p className="text-sm opacity-80">Checking session...</p>
			</main>
		);
	}

	if (status === "authenticated") {
		const nickname = session.user?.name || "Discord user";

		return (
			<main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
				<h1 className="text-2xl font-bold">You are signed in</h1>
				<p className="text-sm opacity-80">Logged in as {nickname}.</p>
				<div className="flex items-center gap-3">
					<Link href={ROUTES.home} className="rounded-lg bg-black px-5 py-3 text-white transition hover:opacity-90">
						Go to home
					</Link>
					<button
						type="button"
						onClick={() => signOut({ callbackUrl: ROUTES.login })}
						className="rounded-lg border border-(--border) px-5 py-3 text-(--text)"
					>
						Sign out
					</button>
				</div>
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
			<h1 className="text-2xl font-bold">Sign in</h1>
			<p className="text-sm opacity-80">Use your Discord account to continue.</p>
			<button
				type="button"
				onClick={() => signIn("discord", { callbackUrl: ROUTES.home })}
				className="rounded-lg bg-black px-5 py-3 text-white transition hover:opacity-90"
			>
				Continue with Discord
			</button>
		</main>
	);
}

