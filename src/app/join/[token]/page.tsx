import Link from "next/link";
import { and, eq, gt } from "drizzle-orm";
import { AuthShell } from "@/components/AuthShell";
import { JoinForm } from "@/components/AuthForms";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/session";
import { fmt } from "@/lib/time";

export const metadata = { title: "Join" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await db();
  const [invite] = await d
    .select()
    .from(schema.invites)
    .where(and(eq(schema.invites.tokenHash, hashToken(token)), eq(schema.invites.revoked, false), gt(schema.invites.expiresAt, new Date())));
  const usable = invite && invite.uses < invite.maxUses;
  return (
    <AuthShell
      eyebrow="AI Collusion Research Sprint · Oct 23–25"
      title="Join the"
      emphasis="team."
      lede={
        usable
          ? `You've been invited to the Outskiller sprint workspace. This link works until ${fmt(invite.expiresAt, "UTC", { weekday: "short", month: "short", day: "numeric" })}.`
          : "This invite link has expired or been used up. Ask an admin for a new one."
      }
    >
      {usable ? <JoinForm token={token} /> : null}
      <p className="muted" style={{ textAlign: "center" }}>
        Already joined? <Link href="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
