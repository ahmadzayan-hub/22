import pg from "pg";

// Separate module so routes/services never import index.ts (avoids the
// route ↔ bootstrap circular import in the original deliverable).
export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
