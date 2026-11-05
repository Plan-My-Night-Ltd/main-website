import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

// Keeps the Supabase session fresh: if the access token has expired, this swaps it
// for a new one and writes the cookies before the page renders.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!authConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip static files and images; they never need the session.
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico|.*\\.(?:jpg|jpeg|png|svg|webp|ico)$).*)"],
};
