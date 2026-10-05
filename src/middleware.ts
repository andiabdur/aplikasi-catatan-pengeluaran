import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Langsung izinkan akses ke endpoint MCP tanpa intervensi sesi / login
  if (request.nextUrl.pathname.startsWith("/api/mcp")) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
