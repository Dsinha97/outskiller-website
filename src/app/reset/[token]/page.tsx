import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "@/components/AuthForms";

export const metadata = { title: "Reset password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell eyebrow="Password reset" title="Choose a new" emphasis="password." lede="This link works once.">
      <ResetForm token={token} />
    </AuthShell>
  );
}
