import { NextResponse } from "next/server";

// Booking enquiries. Order matters: save the row to Supabase first, then email
// via Resend, so an email failure never loses a booking. Until Supabase and
// Resend are configured this validates the request and logs it.

type EnquiryBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  partySize?: unknown;
  nightDate?: unknown;
  notes?: unknown;
  plan?: unknown;
};

export async function POST(request: Request) {
  let body: EnquiryBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request wasn't valid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const partySize = Number(body.partySize);
  const nightDate = typeof body.nightDate === "string" ? body.nightDate : "";

  if (!name) return NextResponse.json({ error: "Add your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    return NextResponse.json({ error: "Party size must be between 1 and 50." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nightDate) || typeof body.plan !== "object" || body.plan === null) {
    return NextResponse.json({ error: "The plan is missing. Reload the page and try again." }, { status: 400 });
  }

  // TODO: insert into `enquiries` with the service role key, then send emails via Resend.
  console.info("[enquiry] not stored yet (Supabase not connected)", { name, email, partySize, nightDate });

  return NextResponse.json({ ok: true, stored: false });
}
