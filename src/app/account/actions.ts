"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await serverSupabase();
  await supabase?.auth.signOut();
  redirect("/");
}

export async function removeSavedPlan(formData: FormData) {
  const supabase = await serverSupabase();
  const id = formData.get("id");
  if (!supabase || typeof id !== "string") return;
  // Row level security limits this to the signed-in person's own plans.
  await supabase.from("saved_plans").delete().eq("id", id);
  revalidatePath("/account");
}

/** Records the person's answer to "can we email you?", with when they gave it. */
export async function setMarketingOptIn(optIn: boolean) {
  const supabase = await serverSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase
    .from("profiles")
    .update({ marketing_opt_in: optIn, marketing_opt_in_at: new Date().toISOString() })
    .eq("id", data.user.id);
  revalidatePath("/account");
}
