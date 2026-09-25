import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <Outlet />
      <BottomNav />
      {profile.isSuccess && !profile.data?.onboarded && (
        <OnboardingWizard
          userId={user.id}
          defaults={{
            full_name:
              profile.data?.full_name ?? (user.user_metadata?.['full_name'] as string | undefined) ?? "",
            whatsapp_number: profile.data?.whatsapp_number ?? user.phone ?? "",
          }}
          onDone={() => profile.refetch()}
        />
      )}
    </>
  );
}
