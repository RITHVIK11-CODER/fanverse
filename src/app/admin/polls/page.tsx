
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Eye,
  CalendarDays,
  Loader2,
  Filter,
  Vote,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PollStatus = "draft" | "scheduled" | "active" | "paused" | "ended";

type Poll = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: PollStatus;
  cover_image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  results_visible: boolean;
  created_at: string;
  category_id: string;
  categories: {
    name: string;
  } | null;
};

const STATUS_OPTIONS: PollStatus[] = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "ended",
];

const STATUS_STYLES: Record<PollStatus, string> = {
  draft: "bg-gray-500/15 text-gray-300 border-gray-500/20",
  scheduled: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  active: "bg-green-500/15 text-green-300 border-green-500/20",
  paused: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  ended: "bg-red-500/15 text-red-300 border-red-500/20",
};

export default function AdminPollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ----------------------------------------
  // Fetch polls
  // ----------------------------------------

  const fetchPolls = useCallback(async (manual = false) => {
    const supabase = createClient();

    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("polls")
        .select(`
          id,
          title,
          slug,
          description,
          status,
          cover_image,
          starts_at,
          ends_at,
          results_visible,
          created_at,
          category_id,
          categories (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setPolls((data || []) as unknown as Poll[]);
    } catch (err) {
      console.error("Poll loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load polls."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchPolls();
  }, [fetchPolls]);

  // ----------------------------------------
  // Search and filter
  // ----------------------------------------

  const filteredPolls = useMemo(() => {
    return polls.filter((poll) => {
      const searchText = search.toLowerCase().trim();

      const matchesSearch =
        !searchText ||
        poll.title.toLowerCase().includes(searchText) ||
        poll.slug.toLowerCase().includes(searchText) ||
        (poll.categories?.name || "").toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "all" || poll.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [polls, search, statusFilter]);

  // ----------------------------------------
  // Status update
  // ----------------------------------------

  const updateStatus = async (
    pollId: string,
    newStatus: PollStatus
  ) => {
    const previousPoll = polls.find((poll) => poll.id === pollId);

    if (!previousPoll || previousPoll.status === newStatus) return;

    setUpdatingId(pollId);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("polls")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pollId);

      if (updateError) throw updateError;

      setPolls((previous) =>
        previous.map((poll) =>
          poll.id === pollId
            ? { ...poll, status: newStatus }
            : poll
        )
      );

      setSuccess("Poll status updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update poll status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // ----------------------------------------
  // Delete poll
  // ----------------------------------------

  const deletePoll = async (poll: Poll) => {
    const confirmed = window.confirm(
      `Delete "${poll.title}"?\n\nThis permanently deletes the poll, its options, votes and reactions. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(poll.id);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();

      const { error: deleteError } = await supabase
        .from("polls")
        .delete()
        .eq("id", poll.id);

      if (deleteError) throw deleteError;

      setPolls((previous) =>
        previous.filter((item) => item.id !== poll.id)
      );

      setSuccess("Poll deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete poll."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ----------------------------------------
  // Format date
  // ----------------------------------------

  const formatDate = (value: string | null) => {
    if (!value) return "Not scheduled";

    return new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // ----------------------------------------
  // Statistics
  // ----------------------------------------

  const stats = {
    total: polls.length,
    active: polls.filter((poll) => poll.status === "active").length,
    scheduled: polls.filter((poll) => poll.status === "scheduled").length,
    ended: polls.filter((poll) => poll.status === "ended").length,
  };

  // ----------------------------------------
  // Page UI
  // ----------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-4 text-white sm:p-6 lg:p-8">
      {/* Header */}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-sm font-medium text-orange-400">
            FANVERSE ADMIN
          </p>

          <h1 className="text-2xl font-bold sm:text-3xl">
            Poll Management
          </h1>

          <p className="mt-2 text-sm text-white/45">
            Create, manage, edit and monitor your cinema polls.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fetchPolls(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <Link
            href="/admin/polls/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110"
          >
            <Plus size={18} />
            Create Poll
          </Link>
        </div>
      </div>

      {/* Alerts */}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
          {success}
        </div>
      )}

      {/* Statistics */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Polls", value: stats.total },
          { label: "Active Polls", value: stats.active },
          { label: "Scheduled", value: stats.scheduled },
          { label: "Ended Polls", value: stats.ended },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <p className="text-sm text-white/45">{item.label}</p>
            <p className="mt-3 text-2xl font-bold">
              {item.value.toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>

      {/* Search and filters */}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by poll title, slug or category..."
              className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-orange-400"
            />
          </div>

          <div className="relative sm:w-52">
            <Filter
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-[#171722] py-3 pl-10 pr-4 text-sm outline-none focus:border-orange-400"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-xs text-white/40">
          Showing {filteredPolls.length} of {polls.length} polls
        </div>
      </section>

      {/* Poll list */}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All Polls</h2>

          <span className="text-xs text-white/40">
            Latest polls first
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <Loader2 className="animate-spin text-orange-400" size={28} />
            <span className="ml-3 text-sm text-white/50">
              Loading polls...
            </span>
          </div>
        ) : filteredPolls.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-16 text-center">
            <Vote className="mx-auto mb-4 text-white/25" size={34} />

            <h3 className="font-semibold">No polls found</h3>

            <p className="mt-2 text-sm text-white/40">
              Try changing your search or status filter.
            </p>

            {polls.length === 0 && (
              <Link
                href="/admin/polls/new"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black"
              >
                <Plus size={17} />
                Create your first poll
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPolls.map((poll) => (
              <article
                key={poll.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-white/20"
              >
                <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-5">
                  {/* Cover image */}

                  <div className="h-36 w-full shrink-0 overflow-hidden rounded-xl bg-white/5 sm:h-28 sm:w-40">
                    {poll.cover_image ? (
                      <img
                        src={poll.cover_image}
                        alt={poll.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl text-white/20">
                        <Vote size={32} />
                      </div>
                    )}
                  </div>

                  {/* Poll details */}

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[poll.status]}`}
                      >
                        {poll.status.charAt(0).toUpperCase() +
                          poll.status.slice(1)}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                        {poll.categories?.name || "Uncategorized"}
                      </span>
                    </div>

                    <h3 className="truncate text-lg font-semibold">
                      {poll.title}
                    </h3>

                    <p className="mt-1 truncate text-xs text-white/40">
                      /polls/{poll.slug}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/40">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={14} />
                        Created {formatDate(poll.created_at)}
                      </span>

                      {poll.ends_at && (
                        <span>
                          Ends {formatDate(poll.ends_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Link
                      href={`/admin/polls/${poll.id}/edit`}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-xs font-medium text-white/70 transition hover:border-orange-400/50 hover:text-orange-400"
                    >
                      <Pencil size={14} />
                      Edit
                    </Link>

                    <Link
                      href={`/polls/${poll.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-xs font-medium text-white/70 transition hover:bg-white/10"
                    >
                      <Eye size={14} />
                      View
                    </Link>

                    <button
                      type="button"
                      onClick={() => deletePoll(poll)}
                      disabled={deletingId === poll.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingId === poll.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status controls */}

                <div className="flex flex-col gap-3 border-t border-white/10 bg-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <span className="text-xs text-white/40">
                    Manage poll availability
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/40">
                      Change status:
                    </span>

                    <select
                      value={poll.status}
                      disabled={
                        updatingId === poll.id ||
                        deletingId === poll.id
                      }
                      onChange={(event) =>
                        updateStatus(
                          poll.id,
                          event.target.value as PollStatus
                        )
                      }
                      className="rounded-lg border border-white/10 bg-[#171722] px-3 py-2 text-xs outline-none focus:border-orange-400 disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() +
                            status.slice(1)}
                        </option>
                      ))}
                    </select>

                    {updatingId === poll.id && (
                      <Loader2
                        size={15}
                        className="animate-spin text-orange-400"
                      />
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
