import { implement, ORPCError } from "@orpc/server";
import type { ApiContext } from "~/lib/orpc/context";
import { apiContract } from "~/lib/orpc/contract";

const orpc = implement(apiContract).$context<ApiContext>();

function requireAuth(context: ApiContext) {
	if (!context.auth) {
		throw new ORPCError("UNAUTHORIZED", {
			message:
				"Missing or invalid API credentials. Use a browser session, Authorization: Bearer <api-key>, x-api-key, or MCP session auth.",
		});
	}
}

/**
 * Concrete procedure implementations behind the canonical oRPC contract.
 */
export const apiRouter = {
	examples: {
		workflow: orpc.examples.workflow.handler(async ({ context, input }) => {
			requireAuth(context);
			const { params, query, body } = input;

			return {
				success: true,
				received: {
					exampleId: params.exampleId,
					query: {
						q: query.q,
						limit: query.limit,
						dryRun: query.dryRun,
						channel: query.channel,
					},
					body: {
						message: body.message,
						priority: body.priority,
					},
				},
				preview: [
					`${params.exampleId}:${query.q}:1`,
					`${params.exampleId}:${query.q}:2`,
					`${params.exampleId}:${query.q}:${query.limit}`,
				],
				message: `Prepared ${query.channel} workflow for ${params.exampleId}${query.dryRun ? " (dry run)" : ""}.`,
			};
		}),
	},
} as const;
