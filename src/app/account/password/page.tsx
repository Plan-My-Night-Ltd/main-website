import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewPasswordForm } from "@/components/password-forms";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default async function NewPasswordPage() {
  if (!(await currentUser())) redirect("/login?next=/account/password");
  return (
    <div className="mx-auto max-w-md px-4 pt-16 pb-8 sm:pt-24">
      <h1 className="text-title font-light">Choose a new password</h1>
      <NewPasswordForm />
    </div>
  );
}
