import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await currentUser()) redirect(next);

  return (
    <div className="mx-auto max-w-md px-4 pt-16 pb-8 sm:pt-24">
      <h1 className="text-title font-light">Sign in</h1>
      <p className="mt-3 text-ash">See your saved nights and the places you&apos;ve been.</p>
      <AuthForm mode="login" next={next} linkError={params.error === "link"} />
    </div>
  );
}
