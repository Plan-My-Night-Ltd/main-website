import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What PlanMyNights collects about you, why, who we share it with, and your rights.",
};

// TODO before launch: fill in who runs PlanMyNights and where to reach them.
// Google and Apple sign-in both ask for this page's address.
const operator = "[Company legal name], [registered address]";
const contactEmail = "[privacy contact email]";
const lastUpdated = "23 November 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-16 pb-8 sm:px-8 sm:pt-24">
      <h1 className="text-title font-light">Privacy policy</h1>
      <p className="mt-4 text-ash">Last updated {lastUpdated}</p>

      <Section title="Who we are">
        <p>
          PlanMyNights plans evenings out in London. It is run by {operator}, which is responsible for your personal
          data (the &ldquo;controller&rdquo;). For anything about your data, email {contactEmail}.
        </p>
      </Section>

      <Section title="What we collect">
        <List>
          <li>
            <strong>Your account.</strong> Your name, email address and password. Passwords are stored encrypted, and we
            can&apos;t see them. If you sign in with Google, we receive your name, email address and profile photo from
            Google. If you sign in with Apple, we receive your name and email address, or an Apple relay address if you
            chose to hide your email.
          </li>
          <li>
            <strong>The nights you plan.</strong> Your answers (date, start time, who you&apos;re going with, party size,
            area, budget, the feel and music you&apos;re after), the plan we made, any venues you swapped, and when you
            planned it.
          </li>
          <li>
            <strong>Places you&apos;ve been.</strong> Venues you mark as visited.
          </li>
          <li>
            <strong>Booking requests.</strong> If you ask us to book, your name, email, phone number, party size, date
            and any notes.
          </li>
          <li>
            <strong>Your email choice.</strong> Whether you want our emails, and when you told us.
          </li>
          <li>
            <strong>Technical data.</strong> Cookies that keep you signed in, and the IP address and browser details
            our hosting provider logs to keep the site secure.
          </li>
        </List>
      </Section>

      <Section title="How we use it, and why we're allowed to">
        <List>
          <li>
            <strong>To run your account and show and save your plans.</strong> This is needed to provide the service
            you signed up for (contract).
          </li>
          <li>
            <strong>To arrange bookings you ask for.</strong> This can mean passing your name, party size and date to
            the venue (contract).
          </li>
          <li>
            <strong>To improve PlanMyNights.</strong> For example, seeing which areas and budgets people choose and how
            often they come back, so our recommendations get better. We have a legitimate interest in understanding
            how the service is used.
          </li>
          <li>
            <strong>To email you our picks of London nights.</strong> Only if you said yes (consent). You can stop
            these at any time from your account or the link in any email.
          </li>
          <li>
            <strong>To keep the site secure and meet our legal duties</strong> (legitimate interests and legal
            obligation).
          </li>
        </List>
        <p className="mt-4">
          We don&apos;t sell your data, and we don&apos;t use it for advertising. We&apos;ll always email you about your
          account and any booking you&apos;ve requested, whatever your email choice.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>Only the companies that help us run PlanMyNights, each under a contract that protects your data:</p>
        <List>
          <li>Supabase, which stores our database and runs sign-in.</li>
          <li>Vercel, which hosts the website.</li>
          <li>Resend, which sends our emails.</li>
          <li>Google or Apple, only if you choose to sign in with them.</li>
          <li>The venue, for a booking you ask us to make.</li>
        </List>
        <p className="mt-4">
          Some of these companies store data outside the UK, including in the United States. When that happens, the
          safeguards UK law requires are in place, such as the UK&ndash;US data bridge or the UK International Data
          Transfer Agreement.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We only use cookies that keep you signed in. They are essential for your account to work, so we don&apos;t
          ask for permission. We don&apos;t use advertising or tracking cookies. If that changes, we&apos;ll update this
          page and ask first.
        </p>
      </Section>

      <Section title="How long we keep it">
        <List>
          <li>Your account, plans and places you&apos;ve been: until you delete your account.</li>
          <li>Booking requests: for two years after the night, then deleted.</li>
          <li>Hosting security logs: for the short period our hosting provider keeps them.</li>
        </List>
        <p className="mt-4">
          Ask us to delete your account at {contactEmail}, and we&apos;ll remove your data within 30 days.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under UK data protection law you can ask to see the data we hold about you, correct it, delete it, receive a
          copy to take elsewhere, or ask us to stop or limit using it. Where we rely on your consent, you can withdraw
          it at any time. Email {contactEmail}, and we&apos;ll reply within one month.
        </p>
        <p className="mt-4">
          If you&apos;re unhappy with how we&apos;ve handled your data, you can complain to the Information
          Commissioner&apos;s Office at{" "}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            ico.org.uk
          </a>{" "}
          or on 0303 123 1113. We&apos;d appreciate the chance to put it right first.
        </p>
      </Section>

      <Section title="Age">
        <p>PlanMyNights is for people aged 18 and over. We don&apos;t knowingly collect data from anyone younger.</p>
      </Section>

      <Section title="Changes">
        <p>
          If we change this policy, we&apos;ll update the date at the top. If a change affects how we use data you&apos;ve
          already given us, we&apos;ll tell you by email first.
        </p>
      </Section>

      <p className="mt-16 text-sm text-ash">
        <Link href="/" className="hover:text-white">
          Back to PlanMyNights
        </Link>
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-line pt-8 leading-relaxed text-white/85">
      <h2 className="mb-4 text-2xl font-light text-white">{title}</h2>
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="mt-4 list-disc space-y-3 pl-5 marker:text-ash [&_strong]:font-normal [&_strong]:text-white">{children}</ul>;
}
