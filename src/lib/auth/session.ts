import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type AppSession = {
  userId: string;
  companyId: string | null;
  companyName: string | null;
  email: string;
  name: string;
  avatarUrl: string | null;
  systemRole: "SYSTEM_ADMIN" | "COMPANY_ADMIN" | "MEMBER" | "NONE";
  permissions: string[];
  scopes: Array<{ scopeType: string; scopeId: string }>;
};

export async function getSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    return null;
  }

  // Supabase Auth → DB User 조회 또는 생성
  const user = await prisma.user.upsert({
    where: { providerUserId: authUser.id },
    update: {
      email: authUser.email,
      name: authUser.user_metadata?.full_name ?? authUser.email,
      avatarUrl: authUser.user_metadata?.avatar_url ?? null,
      lastLoginAt: new Date(),
    },
    create: {
      providerUserId: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.full_name ?? authUser.email,
      avatarUrl: authUser.user_metadata?.avatar_url ?? null,
      status: "ACTIVE",
      lastLoginAt: new Date(),
    },
  });

  if (!user) {
    return null;
  }

  // UserScope 조회 (company, permissionSet 포함)
  const scopes = await prisma.userScope.findMany({
    where: { userId: user.id },
    include: {
      company: true,
      permissionSet: {
        include: {
          items: true,
        },
      },
    },
  });

  // 첫 번째 스코프에서 companyId와 role 추출
  const primaryScope = scopes[0] ?? null;
  const companyId = primaryScope?.companyId ?? null;
  const companyName = primaryScope?.company?.name ?? null;

  // ScopeRole → systemRole 매핑
  let systemRole: AppSession["systemRole"] = "NONE";
  if (primaryScope) {
    switch (primaryScope.role) {
      case "SYSTEM_ADMIN":
        systemRole = "SYSTEM_ADMIN";
        break;
      case "COMPANY_ADMIN":
        systemRole = "COMPANY_ADMIN";
        break;
      case "MEMBER":
        systemRole = "MEMBER";
        break;
      default:
        systemRole = "NONE";
    }
  }

  // 모든 스코프의 PermissionSetItem에서 권한 수집
  const permissions: string[] = [];
  for (const scope of scopes) {
    if (scope.permissionSet?.items) {
      for (const item of scope.permissionSet.items) {
        const perm = `${item.resource}:${item.action}`;
        if (!permissions.includes(perm)) {
          permissions.push(perm);
        }
      }
    }
  }

  return {
    userId: user.id,
    companyId,
    companyName,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    systemRole,
    permissions,
    scopes: scopes.map((s) => ({
      scopeType: "COMPANY",
      scopeId: s.companyId,
    })),
  };
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireCompanySession(): Promise<
  AppSession & { companyId: string }
> {
  const session = await requireSession();
  if (!session.companyId) {
    throw new Error("COMPANY_NOT_ASSIGNED");
  }
  return session as AppSession & { companyId: string };
}
