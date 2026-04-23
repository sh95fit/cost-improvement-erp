import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 공개 경로 정의
  const isAuthPage = pathname.startsWith("/login");
  const isCallbackPage = pathname.startsWith("/auth/callback");
  const isApiRoute = pathname.startsWith("/api");

  // 미인증 사용자 → 로그인으로 리디렉트
  if (!user && !isAuthPage && !isCallbackPage && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 인증된 사용자가 로그인 페이지 접근 → /meal-plans로 리디렉트
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/meal-plans";
    return NextResponse.redirect(url);
  }

  // 루트 경로 → /meal-plans로 리디렉트
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/meal-plans";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
