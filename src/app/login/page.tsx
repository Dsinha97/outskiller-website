import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/AuthForms";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthShell eyebrow="AI Collusion Research Sprint · Oct 23–25" title="Sign in to the" emphasis="team." lede="New here? Use the invite link Deepayan or Liezl posted in WhatsApp or Discord.">
      <LoginForm />
    </AuthShell>
  );
}
