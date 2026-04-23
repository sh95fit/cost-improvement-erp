import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "./get-or-create-user.service";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    return null;
  }

  const user = await getOrCreateUser(supabaseUser);

  return {
    supabaseUser,
    user,
    scopes: user.scopes,
  };
}
