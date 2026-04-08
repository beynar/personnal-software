import { getOpenApiSpec } from "~/lib/api";

/** Minimal catalog entry optimized for MCP tool search. */
export interface CatalogEntry {
	method: string;
	path: string;
	summary: string;
	description: string;
	tags: string[];
	parameters: {
		name: string;
		in: string;
		required: boolean;
		schema?: string;
	}[];
	requestBodyContentTypes: string[];
	responseContentTypes: string[];
	schemaSummary: string;
}

/**
 * Derives a compact route catalog from the in-memory OpenAPI spec.
 * Reads the spec synchronously via `getOpenApiSpec()` — no HTTP fetch needed.
 */
export function buildCatalog(): CatalogEntry[] {
	const spec = getOpenApiSpec() as OpenApiSpec;
	const paths = spec.paths ?? {};
	const entries: CatalogEntry[] = [];

	for (const [path, methods] of Object.entries(paths)) {
		if (!methods) continue;
		for (const [method, op] of Object.entries(methods)) {
			if (
				!op ||
				typeof op !== "object" ||
				!("summary" in op || "responses" in op)
			) {
				continue;
			}
			const operation = op as OperationObject;
			entries.push({
				method: method.toUpperCase(),
				path,
				summary: operation.summary ?? "",
				description: operation.description ?? "",
				tags: operation.tags ?? [],
				parameters: (operation.parameters ?? []).map((p) => ({
					name: p.name,
					in: p.in,
					required: p.required ?? false,
					schema: summarizeSchema(p.schema),
				})),
				requestBodyContentTypes: operation.requestBody?.content
					? Object.keys(operation.requestBody.content)
					: [],
				responseContentTypes: extractResponseContentTypes(operation.responses),
				schemaSummary: buildSchemaSummary(operation),
			});
		}
	}

	return entries;
}

/**
 * Searches the catalog by keyword, matching against path, summary,
 * description, and tags. Returns entries sorted by relevance (number of
 * matched fields).
 */
export function searchCatalog(query: string): CatalogEntry[] {
	const catalog = buildCatalog();
	if (!query) return catalog;

	const q = query.toLowerCase();
	const scored = catalog
		.map((entry) => {
			let score = 0;
			if (entry.path.toLowerCase().includes(q)) score += 3;
			if (entry.summary.toLowerCase().includes(q)) score += 2;
			if (entry.description.toLowerCase().includes(q)) score += 1;
			if (entry.tags.some((t) => t.toLowerCase().includes(q))) score += 2;
			return { entry, score };
		})
		.filter((s) => s.score > 0);

	scored.sort((a, b) => b.score - a.score);
	return scored.map((s) => s.entry);
}

// ---- internal helpers ----

/** Produce a shallow one-line summary of a JSON schema without recursing. */
function summarizeSchema(schema: Record<string, unknown> | undefined): string {
	if (!schema) return "";
	const type = schema.type as string | undefined;
	if (type === "object" && schema.properties) {
		const keys = Object.keys(schema.properties as Record<string, unknown>);
		return `object{${keys.join(", ")}}`;
	}
	if (type === "array" && schema.items) {
		const items = schema.items as Record<string, unknown>;
		return `array<${items.type ?? "unknown"}>`;
	}
	return type ?? "unknown";
}

function extractResponseContentTypes(
	responses: Record<string, ResponseObject> | undefined,
): string[] {
	if (!responses) return [];
	const types = new Set<string>();
	for (const resp of Object.values(responses)) {
		if (resp?.content) {
			for (const ct of Object.keys(resp.content)) {
				types.add(ct);
			}
		}
	}
	return [...types];
}

/** Build a human-readable schema summary for the operation. */
function buildSchemaSummary(op: OperationObject): string {
	const parts: string[] = [];

	// Request body schema
	if (op.requestBody?.content) {
		for (const [ct, media] of Object.entries(op.requestBody.content)) {
			const s = summarizeSchema(media.schema);
			if (s) parts.push(`req(${ct}): ${s}`);
		}
	}

	// Response schemas (only 2xx)
	if (op.responses) {
		for (const [code, resp] of Object.entries(op.responses)) {
			if (!code.startsWith("2") || !resp?.content) continue;
			for (const [ct, media] of Object.entries(resp.content)) {
				const s = summarizeSchema(media.schema);
				if (s) parts.push(`res${code}(${ct}): ${s}`);
			}
		}
	}

	return parts.join("; ") || "none";
}

// ---- minimal OpenAPI type stubs (avoids importing full openapi-types) ----

interface OpenApiSpec {
	paths?: Record<string, Record<string, unknown>>;
}

interface ParameterObject {
	name: string;
	in: string;
	required?: boolean;
	schema?: Record<string, unknown>;
}

interface MediaTypeObject {
	schema?: Record<string, unknown>;
}

interface ResponseObject {
	content?: Record<string, MediaTypeObject>;
}

interface RequestBodyObject {
	content?: Record<string, MediaTypeObject>;
}

interface OperationObject {
	summary?: string;
	description?: string;
	tags?: string[];
	parameters?: ParameterObject[];
	requestBody?: RequestBodyObject;
	responses?: Record<string, ResponseObject>;
}
