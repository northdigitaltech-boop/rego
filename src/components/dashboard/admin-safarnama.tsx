"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Star,
  Trash2,
  Pencil,
  ExternalLink,
  X,
  EyeOff,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAllStories,
  getAllComments,
  setStoryStatus,
  setStoryFeatured,
  setStoryVerified,
  deleteStory,
  updateStory,
  setCommentHidden,
  deleteComment,
  travelTypeLabel,
  type StoryRow,
  type StoryCommentRow,
} from "@/lib/safarnama";
import { cn } from "@/lib/utils";

type View = "stories" | "comments";

export function AdminSafarnama() {
  const [view, setView] = React.useState<View>("stories");
  const [stories, setStories] = React.useState<StoryRow[]>([]);
  const [comments, setComments] = React.useState<StoryCommentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<StoryRow | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [s, c] = await Promise.all([getAllStories(), getAllComments()]);
    setStories(s);
    setComments(c);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const pending = stories.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-forest">Safarnama — Traveler Stories</h2>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {([
            ["stories", `Stories${pending ? ` (${pending})` : ""}`],
            ["comments", "Comments"],
          ] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                view === v ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : view === "stories" ? (
        <StoriesTable stories={stories} onChange={refresh} onEdit={setEditing} />
      ) : (
        <CommentsTable comments={comments} onChange={refresh} />
      )}

      {editing && (
        <EditStoryModal story={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function StoriesTable({
  stories,
  onChange,
  onEdit,
}: {
  stories: StoryRow[];
  onChange: () => void;
  onEdit: (s: StoryRow) => void;
}) {
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };
  const rows = stories.filter((s) =>
    !q.trim() ||
    `${s.title} ${s.author_name ?? ""} ${s.owner_email ?? ""} ${s.destination ?? ""} ${s.city ?? ""} ${s.status}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stories…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} stories</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Story</th>
              <th className="p-3">Author</th>
              <th className="p-3">Type</th>
              <th className="p-3">Views</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No stories match.</td></tr>
            ) : (
              rows.map((s) => {
                const busy = busyId === s.id;
                return (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-forest">
                        <span className="line-clamp-1 max-w-[240px]">{s.title}</span>
                        {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}
                        {s.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.destination || s.city || "—"}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{s.author_name || s.owner_email || "—"}</td>
                    <td className="p-3 text-muted-foreground">{s.travel_type ? travelTypeLabel(s.travel_type) : "—"}</td>
                    <td className="p-3 text-muted-foreground">{s.views}</td>
                    <td className="p-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                        s.status === "approved" ? "bg-forest-50 text-forest-600" :
                        s.status === "pending" ? "bg-gold/20 text-gold-700" : "bg-red-50 text-red-600")}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <a href={`/safarnama/${s.id}`} target="_blank" rel="noopener noreferrer" title="View" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>
                        <button title="Edit" onClick={() => onEdit(s)} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                        {s.status !== "approved" && <button title="Approve" disabled={busy} onClick={() => act(s.id, () => setStoryStatus(s.id, "approved"))} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        {s.status !== "rejected" && <button title="Reject" disabled={busy} onClick={() => act(s.id, () => setStoryStatus(s.id, "rejected"))} className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><XCircle className="h-3.5 w-3.5" /></button>}
                        <button title={s.featured ? "Unfeature" : "Feature"} disabled={busy} onClick={() => act(s.id, () => setStoryFeatured(s.id, !s.featured))} className={cn("rounded-md border p-1.5", s.featured ? "border-gold/40 bg-gold/15 text-gold-700" : "border-border text-forest hover:bg-muted")}><Star className="h-3.5 w-3.5" /></button>
                        <button title={s.verified ? "Unverify" : "Verify traveller"} disabled={busy} onClick={() => act(s.id, () => setStoryVerified(s.id, !s.verified))} className={cn("rounded-md border p-1.5", s.verified ? "border-forest-200 bg-forest-50 text-forest-600" : "border-border text-forest hover:bg-muted")}><BadgeCheck className="h-3.5 w-3.5" /></button>
                        <button title="Delete" disabled={busy} onClick={() => { if (window.confirm(`Delete “${s.title}”?`)) act(s.id, () => deleteStory(s.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommentsTable({ comments, onChange }: { comments: StoryCommentRow[]; onChange: () => void }) {
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };
  const rows = comments.filter((c) =>
    !q.trim() || `${c.user_name ?? ""} ${c.user_email} ${c.text}`.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} comments</span>
      </div>
      <div className="divide-y divide-border/60">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">No comments.</p>
        ) : (
          rows.map((c) => {
            const busy = busyId === c.id;
            return (
              <div key={c.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-forest">
                    {c.user_name || c.user_email}
                    {c.hidden && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Hidden</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button title={c.hidden ? "Unhide" : "Hide"} disabled={busy} onClick={() => act(c.id, () => setCommentHidden(c.id, !c.hidden))} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">
                    {c.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button title="Delete" disabled={busy} onClick={() => { if (window.confirm("Delete this comment?")) act(c.id, () => deleteComment(c.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function EditStoryModal({
  story,
  onClose,
  onSaved,
}: {
  story: StoryRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = React.useState({
    title: story.title,
    destination: story.destination ?? "",
    city: story.city ?? "",
    preview: story.preview ?? "",
    story: story.story ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    await updateStory(story.id, {
      title: f.title.trim(),
      destination: f.destination.trim() || null,
      city: f.city.trim() || null,
      preview: f.preview.trim() || null,
      story: f.story.trim() || null,
    });
    setSaving(false);
    onSaved();
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-forest">Edit story</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <L label="Title"><input className="auth-input" value={f.title} onChange={(e) => set("title", e.target.value)} /></L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Destination"><input className="auth-input" value={f.destination} onChange={(e) => set("destination", e.target.value)} /></L>
            <L label="City"><input className="auth-input" value={f.city} onChange={(e) => set("city", e.target.value)} /></L>
          </div>
          <L label="Preview"><textarea rows={2} className="auth-input resize-none" value={f.preview} onChange={(e) => set("preview", e.target.value)} /></L>
          <L label="Story"><textarea rows={6} className="auth-input resize-none" value={f.story} onChange={(e) => set("story", e.target.value)} /></L>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" className="rounded-lg" onClick={onClose}>Cancel</Button>
          <Button variant="gold" className="rounded-lg" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
