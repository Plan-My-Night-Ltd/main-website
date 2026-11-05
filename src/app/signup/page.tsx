import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false },
};

export default async function SignupPage(props: PageProps<"/signup">) {
  const params = await props.searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await currentUser()) redirect(next);

  return (
    <div className="mx-auto max-w-md px-4 pt-16 pb-8 sm:pt-24">
      <h1 className="text-title font-light">Create an account</h1>
      <p className="mt-3 text-ash">
        Keep every night you plan, and a record of the places you&apos;ve been. Planning a night never needs an account.
      </p>
      <AuthForm mode="signup" next={next} />
    </div>
  );
}
