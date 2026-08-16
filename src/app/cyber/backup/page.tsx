import { HardDriveDownload, ExternalLink, AlertTriangle, Info } from "lucide-react";

export const metadata = { title: "Backup & Recovery" };

/* ============================================================
 * Backup & Recovery.
 *
 * This page shows NO backup status, because the application has
 * no way to read one. Supabase backups are managed in the
 * platform dashboard and are not exposed to the database role
 * this app uses.
 *
 * The alternative — a green "Backups: Healthy" card that is
 * really just hard-coded text — is the single most dangerous
 * thing a security dashboard can contain. You would only
 * discover it was a lie on the day you needed to restore.
 *
 * So this page tells you where to look instead, and what to
 * check when you get there.
 * ============================================================ */

export default function CyberBackupPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Backup &amp; Recovery</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Backup status is not readable from the application.
        </p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="space-y-2 text-xs leading-relaxed text-amber-200/80">
          <p className="font-bold text-amber-200">Why this page is empty on purpose</p>
          <p>
            Supabase manages backups at the platform level. The database role
            this app connects with cannot query backup schedules, retention or
            the last successful run — so any status shown here would be
            invented, not measured.
          </p>
          <p>
            A dashboard that says &ldquo;Backups: Healthy&rdquo; without checking
            is worse than one that says nothing. You would find out it was
            wrong on the one day it mattered.
          </p>
        </div>
      </div>

      <Card
        title="Where the real status lives"
        icon={<HardDriveDownload className="h-4 w-4" />}
      >
        <Step n={1}>
          Supabase Dashboard → your project → <strong>Database → Backups</strong>.
          That page shows the actual schedule and the most recent successful backup.
        </Step>
        <Step n={2}>
          Check the <strong>retention window</strong>. On the free plan this is
          typically 7 days of daily backups with no point-in-time recovery,
          meaning the most you can lose is roughly 24 hours of data.
        </Step>
        <Step n={3}>
          Note whether <strong>point-in-time recovery</strong> is enabled. It is
          a paid add-on. Without it you can only restore to a daily snapshot.
        </Step>
      </Card>

      <Card title="What to verify, and how often" icon={<Info className="h-4 w-4" />}>
        <Step n={1}>
          <strong>Confirm a backup exists at all.</strong> Once, today. Most
          people assume this and have never looked.
        </Step>
        <Step n={2}>
          <strong>Do a restore rehearsal.</strong> Restore into a scratch project
          and check the row counts. An untested backup is a hope, not a plan —
          this is the step almost everyone skips.
        </Step>
        <Step n={3}>
          <strong>Write down your recovery target.</strong> How much data can you
          afford to lose, and how long can Rego be down? Until those two numbers
          exist, there is no way to say whether the current setup is adequate.
        </Step>
        <Step n={4}>
          <strong>Cloudinary is separate.</strong> Listing photos and CVs live
          there, not in Supabase. A database restore brings back the URLs, not
          the images. Check what Cloudinary retains on your plan.
        </Step>
      </Card>

      <Card title="If you want this page to show real data" icon={<ExternalLink className="h-4 w-4" />}>
        <p className="text-xs leading-relaxed text-slate-400">
          Supabase&apos;s Management API can report backup state, but it needs a
          personal access token with account-level scope. That is a materially
          more powerful credential than the service-role key — it can administer
          projects, not just data. Putting one in this app to populate a status
          card would trade a real increase in blast radius for a convenience.
          Checking the dashboard directly is the better bargain.
        </p>
      </Card>
    </div>
  );
}

function Card({
  title, icon, children,
}: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {icon}{title}
      </p>
      <div className="mt-3 space-y-2.5">{children}</div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-400">
        {n}
      </span>
      <p className="text-xs leading-relaxed text-slate-400">{children}</p>
    </div>
  );
}
