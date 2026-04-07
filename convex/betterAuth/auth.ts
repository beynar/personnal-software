import { createAuth } from "../auth";

// Export a static instance for Better Auth schema generation.
// This file is only used by the Better Auth CLI — do not import at runtime.
// biome-ignore lint/suspicious/noExplicitAny: static instance for schema generation only
export const auth = createAuth({} as any);
