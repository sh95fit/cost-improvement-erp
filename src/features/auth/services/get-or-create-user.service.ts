import prisma from "@/lib/prisma";

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
};

export async function getOrCreateUser(supabaseUser: SupabaseUser) {
  const providerUserId = supabaseUser.id;
  const email = supabaseUser.email ?? "";
  const name =
    supabaseUser.user_metadata?.full_name ??
    supabaseUser.user_metadata?.name ??
    email.split("@")[0];
  const avatarUrl = supabaseUser.user_metadata?.avatar_url ?? null;

  const user = await prisma.user.upsert({
    where: { providerUserId },
    update: {
      email,
      name,
      avatarUrl,
      lastLoginAt: new Date(),
    },
    create: {
      providerUserId,
      email,
      name,
      avatarUrl,
      status: "ACTIVE",
      lastLoginAt: new Date(),
    },
    include: {
      scopes: {
        include: {
          company: true,
          permissionSet: {
            include: {
              items: true,
            },
          },
        },
      },
    },
  });

  return user;
}
