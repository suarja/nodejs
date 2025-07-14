import { Database } from "../config/supabase-types";

export type User = Database["public"]["Tables"]["users"]["Row"];
