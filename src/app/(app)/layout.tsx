import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/Sidebar";
import { db, schema } from "@/db";
import { pendingCount } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { zoneName } from "@/lib/time";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const d = await db();
  const [poll] = await d.select({ status: schema.polls.status }).from(schema.polls).where(eq(schema.polls.kind, "plan"));
  const pending = me.role === "admin" ? await pendingCount() : 0;
  const zone = zoneName(me.tz).replace(/ (Standard|Daylight) Time$/, "").replace(/ Time$/, "");
  return (
    <div className="shell">
      <Sidebar user={{ name: me.name, role: me.role, zone }} pending={pending} pollOpen={poll?.status === "open"} teamProject={poll?.status === "decided"} />
      <main className="main" id="content">
        {children}
      </main>
    </div>
  );
}
