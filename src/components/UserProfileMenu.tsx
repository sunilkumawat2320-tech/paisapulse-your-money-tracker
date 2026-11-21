import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  User,
  LogOut,
  Settings,
  FileSpreadsheet,
  CreditCard,
  ChevronDown,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { ProfileSettingsDialog } from "@/components/ProfileSettingsDialog";
import { TransactionLedgerModal } from "@/components/TransactionLedgerModal";
import { UserManualModal } from "@/components/UserManualModal";
import { SafetyGuidelinesModal } from "@/components/SafetyGuidelinesModal";
import { formatINR } from "@/lib/format";

export function UserProfileMenu() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["user_profile_header"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, monthly_income, upi_id, whatsapp_number")
        .eq("id", user.id)
        .maybeSingle();

      return {
        user,
        profile,
      };
    },
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    toast.info("Signed out");
    navigate({ to: "/auth" });
  }

  if (!data?.user) {
    return null;
  }

  const fullName = data.profile?.full_name || data.user.email?.split("@")[0] || "User";
  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full p-0.5 border border-border/80 bg-card hover:bg-muted/80 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95"
            aria-label="User profile and settings"
          >
            <Avatar className="h-8 w-8 ring-1 ring-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-3 w-3 text-muted-foreground mr-1 hidden sm:inline-block" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5 shadow-float">
          <DropdownMenuLabel className="p-2">
            <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate font-normal">
              {data.user.email}
            </p>
            {data.profile?.monthly_income ? (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                <CreditCard className="h-3 w-3" />
                <span>{formatINR(Number(data.profile.monthly_income))}/mo</span>
              </div>
            ) : null}
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setProfileDialogOpen(true)}
            className="cursor-pointer gap-2 rounded-xl py-2 text-xs font-medium"
          >
            <User className="h-4 w-4 text-primary" />
            <span>Profile & Money Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setLedgerOpen(true)}
            className="cursor-pointer gap-2 rounded-xl py-2 text-xs font-medium"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Transaction Ledger</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setManualOpen(true)}
            className="cursor-pointer gap-2 rounded-xl py-2 text-xs font-medium"
          >
            <BookOpen className="h-4 w-4 text-primary" />
            <span>User Manual</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setSafetyOpen(true)}
            className="cursor-pointer gap-2 rounded-xl py-2 text-xs font-medium"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Safety Guidelines</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer gap-2 rounded-xl py-2 text-xs font-medium text-danger hover:text-danger focus:text-danger focus:bg-danger-soft"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileSettingsDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        userId={data.user.id}
        initialData={data.profile}
      />

      <TransactionLedgerModal open={ledgerOpen} onOpenChange={setLedgerOpen} />

      <UserManualModal open={manualOpen} onOpenChange={setManualOpen} />

      <SafetyGuidelinesModal open={safetyOpen} onOpenChange={setSafetyOpen} />
    </>
  );
}
