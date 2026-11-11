
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Vote,
  Tags,
  BarChart3,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Settings,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type RecentPoll = {
  id: string;
  title: string;
  category: string;
  votes: number;
  status: string;
};

const navigation = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Poll Management", href: "/admin/polls", icon: Vote },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Results Studio", href: "/admin/results", icon: BarChart3 },
  { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
];

const quickActions = [
  {
    title: "Create New Poll",
    description: "Launch a new fan poll.",
    href: "/admin/polls/new",
    icon: Plus,
  },
  {
    title: "Manage Polls",
    description: "Edit and control voting.",
    href: "/admin/polls",
    icon: Vote,
  },
  {
    title: "Manage Categories",
    description: "Organise poll categories.",
    href: "/admin/categories",
    icon: Tags,
  },
  {
    title: "Results Studio",
    description: "Analyse and share results.",
    href: "/admin/results",
    icon: BarChart3,
  },
  {
    title: "Analytics Dashboard",
    description: "Track votes, reactions and performance.",
    href: "/admin/analytics",
    icon: TrendingUp,
  },
];

export default function AdminDashboard() {
  const supabase = createClient();

  const [totalPolls, setTotalPolls] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [activePolls, setActivePolls] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);

  const [recentPolls, setRecentPolls] = useState<RecentPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        pollsCountResult,
        votesCountResult,
        activeCountResult,
        categoriesCountResult,
        pollsResult,
        categoriesResult,
      ] = await Promise.all([
        supabase
          .from("polls")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("votes")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("polls")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),

        supabase
          .from("categories")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("polls")
          .select("id, title, status, category_id, created_at")
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("categories")
          .select("id, name"),
      ]);

      const firstError =
        pollsCountResult.error ||
        votesCountResult.error ||
        activeCountResult.error ||
        categoriesCountResult.error ||
        pollsResult.error ||
        categoriesResult.error;

      if (firstError) {
        throw firstError;
      }

      setTotalPolls(pollsCountResult.count ?? 0);
      setTotalVotes(votesCountResult.count ?? 0);
      setActivePolls(activeCountResult.count ?? 0);
      setTotalCategories(categoriesCountResult.count ?? 0);

      const polls = pollsResult.data ?? [];
      const categories = categoriesResult.data ?? [];

      const categoryMap = new Map(
        categories.map((category) => [category.id, category.name])
      );

      let voteRows: { poll_id: string }[] = [];

      if (polls.length > 0) {
        const { data, error: voteError } = await supabase
          .from("votes")
          .select("poll_id")
          .in(
            "poll_id",
            polls.map((poll) => poll.id)
          );

        if (voteError) {
          throw voteError;
        }

        voteRows = data ?? [];
      }

      const voteCountMap = new Map<string, number>();

      voteRows.forEach((vote) => {
        voteCountMap.set(
          vote.poll_id,
          (voteCountMap.get(vote.poll_id) ?? 0) + 1
        );
      });

      const formattedPolls: RecentPoll[] = polls.map((poll) => ({
        id: poll.id,
        title: poll.title,
        category: categoryMap.get(poll.category_id) ?? "Uncategorised",
        votes: voteCountMap.get(poll.id) ?? 0,
        status:
          poll.status.charAt(0).toUpperCase() + poll.status.slice(1),
      }));

      setRecentPolls(formattedPolls);
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const isActive = (href: string, pathname: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const [pathname, setPathname] = useState("/admin");

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const stats = [
    {
      label: "Total Polls",
      value: totalPolls,
      icon: Vote,
      description: "All created polls",
    },
    {
      label: "Total Votes",
      value: totalVotes,
      icon: TrendingUp,
      description: "All recorded votes",
    },
    {
      label: "Active Polls",
      value: activePolls,
      icon: BarChart3,
      description: "Currently running",
    },
    {
      label: "Categories",
      value: totalCategories,
      icon: Tags,
      description: "Available categories",
    },
  ];

  return (
    <main className="min-h-screen bg-[#090910] text-white">
      <div className="flex min-h-screen">

        {/* SIDEBAR */}

        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0d0d16] p-6 md:flex md:flex-col">
          <Link href="/" className="mb-10 block">
            <h1 className="text-2xl font-black tracking-tight">
              FAN<span className="text-orange-400">VERSE</span>
            </h1>
            <p className="mt-1 text-[10px] tracking-[0.3em] text-gray-500">
              ADMIN WORKSPACE
            </p>
          </Link>

          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Workspace
          </p>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-orange-500/15 text-orange-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={19} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-6">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <ExternalLink size={18} />
              Visit Public Website
            </Link>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500">Platform</p>
              <p className="mt-1 font-semibold">FanVerse</p>
              <p className="mt-1 text-xs text-gray-500">
                Powered by Kage Origin
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}

        <section className="min-w-0 flex-1 p-5 md:p-9">

          {/* HEADER */}

          <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-widest text-orange-400">
                ADMIN WORKSPACE
              </p>

              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                Dashboard
              </h2>

              <p className="mt-2 text-sm text-gray-400">
                Welcome to your FanVerse management dashboard.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadDashboard}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <Link
                href="/admin/polls/new"
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold transition hover:bg-orange-600"
              >
                <Plus size={18} />
                Create Poll
              </Link>
            </div>
          </header>

          {/* MOBILE NAVIGATION */}

          <div className="mb-7 grid grid-cols-2 gap-2 md:hidden">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl border border-white/10 p-3 text-sm ${
                    active
                      ? "bg-orange-500/15 text-orange-400"
                      : "bg-white/[0.03] text-gray-300"
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* ERROR MESSAGE */}

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <p className="font-semibold">Dashboard data could not load.</p>
              <p className="mt-1 break-words">{error}</p>
              <p className="mt-2 text-xs text-red-200/70">
                Check your Supabase connection and admin read permissions.
              </p>
            </div>
          )}

          {/* STATISTICS */}

          <div className="mb-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.label}
                  className="glass rounded-2xl border border-white/10 p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      {stat.label}
                    </p>
                    <Icon size={21} className="text-orange-400" />
                  </div>

                  <h3 className="mt-4 text-3xl font-bold tabular-nums">
                    {loading ? (
                      <span className="inline-block h-9 w-20 animate-pulse rounded-lg bg-white/10" />
                    ) : (
                      stat.value.toLocaleString("en-IN")
                    )}
                  </h3>

                  <p className="mt-2 text-xs text-gray-500">
                    {stat.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* QUICK ACTIONS */}

          <section className="mb-9">
            <h3 className="mb-4 text-xl font-bold">Quick Actions</h3>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="glass group rounded-2xl border border-white/10 p-5 transition hover:border-orange-400/40 hover:bg-white/[0.05]"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div className="rounded-xl bg-orange-500/10 p-3 text-orange-400">
                        <Icon size={21} />
                      </div>

                      <ArrowUpRight
                        size={18}
                        className="text-gray-500 transition group-hover:text-orange-400"
                      />
                    </div>

                    <h4 className="font-bold">{action.title}</h4>

                    <p className="mt-2 text-sm text-gray-500">
                      {action.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* RECENT POLLS */}

          <section className="glass rounded-2xl border border-white/10 p-5 md:p-7">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Recent Polls</h3>
                <p className="mt-1 text-sm text-gray-400">
                  Your five latest polls from Supabase.
                </p>
              </div>

              <Link
                href="/admin/polls"
                className="flex items-center gap-2 text-sm font-semibold text-orange-400 hover:text-orange-300"
              >
                View All
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-gray-500">
                    <th className="pb-4">Poll</th>
                    <th className="pb-4">Category</th>
                    <th className="pb-4">Votes</th>
                    <th className="pb-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-gray-400"
                      >
                        <Loader2 className="mx-auto mb-2 animate-spin" />
                        Loading recent polls...
                      </td>
                    </tr>
                  ) : recentPolls.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-gray-500"
                      >
                        No polls found. Create your first FanVerse poll.
                      </td>
                    </tr>
                  ) : (
                    recentPolls.map((poll) => (
                      <tr
                        key={poll.id}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="py-5 pr-4 text-sm font-medium">
                          {poll.title}
                        </td>

                        <td className="py-5 text-sm text-gray-400">
                          {poll.category}
                        </td>

                        <td className="py-5 text-sm tabular-nums">
                          {poll.votes.toLocaleString("en-IN")}
                        </td>

                        <td className="py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${
                              poll.status === "Active"
                                ? "bg-green-500/15 text-green-400"
                                : poll.status === "Scheduled" ||
                                    poll.status === "Draft"
                                  ? "bg-blue-500/15 text-blue-400"
                                  : poll.status === "Paused"
                                    ? "bg-yellow-500/15 text-yellow-400"
                                    : "bg-gray-500/15 text-gray-400"
                            }`}
                          >
                            {poll.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* FOOTER */}

          <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-gray-500">
            <p>FanVerse Admin Dashboard</p>

            <p className="flex items-center gap-2">
              <Settings size={14} />
              Powered by Kage Origin
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}
