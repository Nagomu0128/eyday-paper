import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/** Drizzle client bound to the request's D1 binding. */
export const createDb = (d1: D1Database) => drizzle(d1, { schema });

export type Database = ReturnType<typeof createDb>;
