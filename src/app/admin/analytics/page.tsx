
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Clock3,
  RefreshCw,
  ThumbsUp,
  Trophy,
  Vote,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

import { createClient } from "@/lib/supabase/client";

type Poll = {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
  ends_at: string | null;
};

type ActivityRecord = {
  created_at: string;
  poll_id: string;
};

type PollPerformance = Poll & {
  votes: number;
  reactions: number;
};

type DailyActivity = {
  date: string;
  votes: number;
  reactions: number;
};

type AnalyticsData = {
  totalPolls: number;
  activePolls: number;
  scheduledPolls: number;
  endedPolls: number;
  totalVotes: number;
  totalReactions: number;
  performance: PollPerformance[];
  activity: DailyActivity[];
};

type RealtimeStatus = "CONNECTING" | "LIVE" | "RECONNECTING" | "OFFLINE";

const EMPTY_ANALYTICS: AnalyticsData = {
  totalPolls: 0,
  activePolls: 0,
  scheduledPolls: 0,
  endedPolls: 0,
  totalVotes: 0,
  totalReactions: 0,
  performance: [],
  activity: [],
};

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] =
    useState<AnalyticsData>(EMPTY_ANALYTICS);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("CONNECTING");

  // ----------------------------------------
  // Fetch analytics
  // ----------------------------------------

  const fetchAnalytics = useCallback(
    async (manual = false, silent = false) => {
      const supabase = createClient();

      if (manual) {
        setRefreshing(true);
      } else if (!silent) {
        setLoading(true);
      }

      setError("");

      try {
        // Fetch polls and global counts

        const [
          pollResponse,
          voteCountResponse,
          reactionCountResponse,
        ] = await Promise.all([
          supabase
            .from("polls")
            .select("id, title, slug, status, created_at, ends_at")
            .order("created_at", { ascending: false }),

          supabase
            .from("votes")
            .select("id", { count: "exact", head: true }),

          supabase
            .from("reactions")
            .select("id", { count: "exact", head: true }),
        ]);

        if (pollResponse.error) throw pollResponse.error;
        if (voteCountResponse.error) throw voteCountResponse.error;
        if (reactionCountResponse.error) {
          throw reactionCountResponse.error;
        }

        const polls = (pollResponse.data || []) as Poll[];

        const totalVotes = voteCountResponse.count || 0;
        const totalReactions = reactionCountResponse.count || 0;

        // Fetch performance for each poll

        const performanceResults = await Promise.all(
          polls.map(async (poll) => {
            const [votesResponse, reactionsResponse] =
              await Promise.all([
                supabase
                  .from("votes")
                  .select("id", { count: "exact", head: true })
                  .eq("poll_id", poll.id),

                supabase
                  .from("reactions")
                  .select("id", { count: "exact", head: true })
                  .eq("poll_id", poll.id),
              ]);

            if (votesResponse.error) throw votesResponse.error;
            if (reactionsResponse.error) {
              throw reactionsResponse.error;
            }

            return {
              ...poll,
              votes: votesResponse.count || 0,
              reactions: reactionsResponse.count || 0,
            };
          })
        );

        // Fetch activity for the last seven days

        const now = new Date();

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const [voteActivityResponse, reactionActivityResponse] =
          await Promise.all([
            supabase
              .from("votes")
              .select("created_at, poll_id")
              .gte("created_at", sevenDaysAgo.toISOString())
              .order("created_at", { ascending: false })
              .limit(10000),

            supabase
              .from("reactions")
              .select("created_at, poll_id")
              .gte("created_at", sevenDaysAgo.toISOString())
              .order("created_at", { ascending: false })
              .limit(10000),
          ]);

        if (voteActivityResponse.error) {
          throw voteActivityResponse.error;
        }

        if (reactionActivityResponse.error) {
          throw reactionActivityResponse.error;
        }

        const voteActivity =
          (voteActivityResponse.data || []) as ActivityRecord[];

        const reactionActivity =
          (reactionActivityResponse.data || []) as ActivityRecord[];

        // Build daily activity

        const dailyMap = new Map<string, DailyActivity>();

        for (let i = 0; i < 7; i++) {
          const date = new Date(sevenDaysAgo);
          date.setDate(sevenDaysAgo.getDate() + i);

          const key = getDateKey(date);

          dailyMap.set(key, {
            date: key,
            votes: 0,
            reactions: 0,
          });
        }

        voteActivity.forEach((item) => {
          const key = getDateKey(new Date(item.created_at));
          const day = dailyMap.get(key);

          if (day) day.votes += 1;
        });

        reactionActivity.forEach((item) => {
          const key = getDateKey(new Date(item.created_at));
          const day = dailyMap.get(key);

          if (day) day.reactions += 1;
        });

        const activity = Array.from(dailyMap.values());

        // Save analytics

        setAnalytics({
          totalPolls: polls.length,
          activePolls: polls.filter(
            (poll) => poll.status === "active"
          ).length,
          scheduledPolls: polls.filter(
            (poll) => poll.status === "scheduled"
          ).length,
          endedPolls: polls.filter(
            (poll) => poll.status === "ended"
          ).length,
          totalVotes,
          totalReactions,
          performance: performanceResults.sort(
            (a, b) => b.votes - a.votes
          ),
          activity,
        });
      } catch (err) {
        console.error("Analytics loading error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load analytics."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }

        if (manual) {
          setRefreshing(false);
        }
      }
    },
    []
  );

  // ----------------------------------------
  // Initial data load
  // ----------------------------------------

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  // ----------------------------------------
  // Supabase Realtime subscription
  // ----------------------------------------

  useEffect(() => {
    const supabase = createClient();

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel("fanverse-admin-analytics")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_activity",
        },
        () => {
          // Combine rapid events into one analytics refresh.

          if (refreshTimer) {
            clearTimeout(refreshTimer);
          }

          refreshTimer = setTimeout(() => {
            void fetchAnalytics(false, true);
          }, 500);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("LIVE");
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          setRealtimeStatus("RECONNECTING");
        } else if (status === "CLOSED") {
          setRealtimeStatus("OFFLINE");
        } else {
          setRealtimeStatus("CONNECTING");
        }
      });

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [fetchAnalytics]);

  // ----------------------------------------
  // Derived data
  // ----------------------------------------

  const topPolls = useMemo(
    () => analytics.performance.slice(0, 5),
    [analytics.performance]
  );

  const totalActivity = useMemo(
    () =>
      analytics.activity.reduce(
        (total, day) => total + day.votes + day.reactions,
        0
      ),
    [analytics.activity]
  );

  // ----------------------------------------
  // Loading screen
  // ----------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white">
        <Loader2 className="animate-spin text-orange-400" size={28} />
        <span className="ml-3 text-sm text-white/50">
          Loading analytics...
        </span>
      </div>
    );
  }

  // ----------------------------------------
  // UI
  // ----------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 text-white sm:p-6 lg:p-8">

      {/* Header */}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-sm font-medium text-orange-400">
            FANVERSE ADMIN
          </p>

          <h1 className="text-2xl font-bold sm:text-3xl">
            Analytics Dashboard
          </h1>

          <p className="mt-2 text-sm text-white/45">
            Track community activity and poll performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          {/* Realtime status */}

          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
            {realtimeStatus === "LIVE" ? (
              <>
                <Wifi size={16} className="text-green-400" />
                <span className="text-green-400">Live Updates</span>
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              </>
            ) : realtimeStatus === "RECONNECTING" ||
              realtimeStatus === "CONNECTING" ? (
              <>
                <RefreshCw
                  size={15}
                  className="animate-spin text-yellow-400"
                />
                <span className="text-yellow-400">
                  {realtimeStatus === "CONNECTING"
                    ? "Connecting..."
                    : "Reconnecting..."}
                </span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-red-400" />
                <span className="text-red-400">Offline</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm text-white/70 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* Error */}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
          <p className="mt-2 text-xs text-red-300/70">
            Check that your authenticated admin account has SELECT access
            to polls, votes and reactions.
          </p>
        </div>
      )}

      {/* Main statistics */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Polls",
            value: analytics.totalPolls,
            icon: BarChart3,
            color: "text-orange-400",
          },
          {
            label: "Total Votes",
            value: analytics.totalVotes,
            icon: Vote,
            color: "text-green-400",
          },
          {
            label: "Total Reactions",
            value: analytics.totalReactions,
            icon: ThumbsUp,
            color: "text-pink-400",
          },
          {
            label: "Activity (7 Days)",
            value: totalActivity,
            icon: Activity,
            color: "text-violet-400",
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/45">{item.label}</p>
                <Icon size={20} className={item.color} />
              </div>

              <p className="mt-5 text-3xl font-bold">
                {formatNumber(item.value)}
              </p>
            </div>
          );
        })}
      </section>

      {/* Poll status */}

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Poll Overview
        </h2>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Active",
              value: analytics.activePolls,
              color: "text-green-400",
              dot: "bg-green-400",
            },
            {
              label: "Scheduled",
              value: analytics.scheduledPolls,
              color: "text-blue-400",
              dot: "bg-blue-400",
            },
            {
              label: "Ended",
              value: analytics.endedPolls,
              color: "text-red-400",
              dot: "bg-red-400",
            },
            {
              label: "Other / Draft",
              value:
                analytics.totalPolls -
                analytics.activePolls -
                analytics.scheduledPolls -
                analytics.endedPolls,
              color: "text-gray-300",
              dot: "bg-gray-400",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                <p className="text-sm text-white/50">{item.label}</p>
              </div>

              <p className={`mt-4 text-2xl font-bold ${item.color}`}>
                {formatNumber(item.value)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Activity chart */}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Community Activity
          </h2>

          <p className="mt-1 text-sm text-white/40">
            Votes and reactions during the last seven days.
          </p>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={analytics.activity.map((day) => ({
                ...day,
                date: formatShortDate(day.date),
              }))}
              margin={{
                top: 10,
                right: 15,
                left: -15,
                bottom: 5,
              }}
            >
              <CartesianGrid
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 4"
              />

              <XAxis
                dataKey="date"
                tick={{ fill: "#999", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                allowDecimals={false}
                tick={{ fill: "#999", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                contentStyle={{
                  background: "#171722",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />

              <Legend />

              <Line
                type="monotone"
                dataKey="votes"
                name="Votes"
                stroke="#f97316"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />

              <Line
                type="monotone"
                dataKey="reactions"
                name="Reactions"
                stroke="#a78bfa"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top performing polls */}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Top Performing Polls
          </h2>

          <p className="mt-1 text-sm text-white/40">
            Ranked by total votes.
          </p>
        </div>

        {topPolls.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/40">
            No polls available yet.
          </p>
        ) : (
          <div className="space-y-5">
            {topPolls.map((poll, index) => {
              const maxVotes = Math.max(
                ...topPolls.map((item) => item.votes),
                1
              );

              const percentage = (poll.votes / maxVotes) * 100;

              return (
                <div key={poll.id}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {poll.title}
                        </p>

                        <p className="mt-1 text-xs text-white/40">
                          {poll.status}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold">
                        {formatNumber(poll.votes)} votes
                      </p>

                      <p className="text-xs text-white/40">
                        {formatNumber(poll.reactions)} reactions
                      </p>
                    </div>
                  </div>

                  <div className="ml-11 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300 transition-all duration-700"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Performance comparison */}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Poll Performance Comparison
          </h2>

          <p className="mt-1 text-sm text-white/40">
            Compare votes across your latest polls.
          </p>
        </div>

        {analytics.performance.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/40">
            No poll data available.
          </p>
        ) : (
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.performance.slice(0, 8).map((poll) => ({
                  name:
                    poll.title.length > 20
                      ? `${poll.title.slice(0, 20)}...`
                      : poll.title,
                  votes: poll.votes,
                  reactions: poll.reactions,
                }))}
                margin={{
                  top: 10,
                  right: 10,
                  left: -15,
                  bottom: 35,
                }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 4"
                />

                <XAxis
                  dataKey="name"
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  tick={{ fill: "#999", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#999", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  contentStyle={{
                    background: "#171722",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                />

                <Legend />

                <Bar
                  dataKey="votes"
                  name="Votes"
                  fill="#f97316"
                  radius={[5, 5, 0, 0]}
                />

                <Bar
                  dataKey="reactions"
                  name="Reactions"
                  fill="#8b5cf6"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Daily activity */}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <CalendarDays className="text-orange-400" size={20} />

          <div>
            <h2 className="font-semibold">Daily Activity Summary</h2>
            <p className="mt-1 text-xs text-white/40">
              Last seven days
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {analytics.activity.map((day) => (
            <div
              key={day.date}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span className="text-sm text-white/60">
                {new Date(`${day.date}T00:00:00`).toLocaleDateString(
                  "en-IN",
                  {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }
                )}
              </span>

              <div className="flex items-center gap-5 text-xs">
                <span className="text-orange-300">
                  {formatNumber(day.votes)} votes
                </span>

                <span className="text-violet-300">
                  {formatNumber(day.reactions)} reactions
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/35">
        <span>FanVerse Admin Analytics</span>

        <span className="flex items-center gap-2">
          <Clock3 size={13} />
          {realtimeStatus === "LIVE"
            ? "Connected to live activity"
            : "Automatic updates unavailable"}
        </span>
      </div>
    </div>
  );
}
