import type { Metadata } from "next";
import { RequestResetForm } from "@/components/password-forms";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 pb-8 sm:pt-24">
      <h1 className="text-title font-light">Reset your password</h1>
      <p className="mt-3 text-ash">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <RequestResetForm />
    </div>
  );
}
