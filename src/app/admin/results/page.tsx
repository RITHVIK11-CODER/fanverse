
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Share2,
  Copy,
  Download,
  ChartColumnIncreasing,
  Users,
  Vote,
  Check,
  RefreshCw,
  Search,
  Loader2,
  Eye,
  EyeOff,
  Crown,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { createClient } from "@/lib/supabase/client";

type Poll = {
  id: string;
  title: string;
  slug: string;
  status: string;
  results_visible: boolean;
  created_at: string;
};

type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
  image_url: string | null;
  display_order: number;
};

type ResultOption = PollOption & {
  votes: number;
  percentage: number;
};

type VoteRow = {
  option_id: string;
};

type FilterStatus = "all" | "active" | "scheduled" | "ended" | "paused" | "draft";

export default function ResultsDashboard() {
  const supabase = useMemo(() => createClient(), []);

  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState("");

  const [options, setOptions] = useState<PollOption[]>([]);
  const [voteRows, setVoteRows] = useState<VoteRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);

  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const [template, setTemplate] = useState("winner");
  const [format, setFormat] = useState("story");

  // ----------------------------------------
  // Load polls
  // ----------------------------------------

  const loadPolls = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: pollError } = await supabase
        .from("polls")
        .select("id, title, slug, status, results_visible, created_at")
        .order("created_at", { ascending: false });

      if (pollError) throw pollError;

      const records = (data ?? []) as Poll[];

      setPolls(records);

      setSelectedPollId((current) => {
        if (current && records.some((poll) => poll.id === current)) {
          return current;
        }

        return records[0]?.id ?? "";
      });
    } catch (err) {
      console.error("Results Studio loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load polls."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadPolls();
  }, [loadPolls]);

  // ----------------------------------------
  // Fetch selected poll results
  // ----------------------------------------

  const fetchResults = useCallback(
    async (pollId: string, manual = false) => {
      if (!pollId) {
        setOptions([]);
        setVoteRows([]);
        return;
      }

      if (manual) {
        setRefreshing(true);
      }

      setError("");

      try {
        const { data: optionData, error: optionError } = await supabase
          .from("poll_options")
          .select("id, poll_id, option_text, image_url, display_order")
          .eq("poll_id", pollId)
          .order("display_order", { ascending: true });

        if (optionError) throw optionError;

        const optionRecords = (optionData ?? []) as PollOption[];
        setOptions(optionRecords);

        // Fetch vote rows in pages so larger polls are not
        // restricted to Supabase's default first-page limit.

        const allVotes: VoteRow[] = [];
        const pageSize = 1000;
        let from = 0;

        while (true) {
          const { data, error: voteError } = await supabase
            .from("votes")
            .select("option_id")
            .eq("poll_id", pollId)
            .range(from, from + pageSize - 1);

          if (voteError) throw voteError;

          const page = (data ?? []) as VoteRow[];
          allVotes.push(...page);

          if (page.length < pageSize) break;

          from += pageSize;
        }

        setVoteRows(allVotes);
      } catch (err) {
        console.error("Poll results error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load poll results."
        );
      } finally {
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!selectedPollId) return;

    void fetchResults(selectedPollId);
  }, [selectedPollId, fetchResults]);

  // ----------------------------------------
  // Realtime updates
  // ----------------------------------------

  useEffect(() => {
    if (!selectedPollId) {
      setRealtimeConnected(false);
      return;
    }

    const channel = supabase
      .channel(`results-studio-${selectedPollId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_activity",
          filter: `poll_id=eq.${selectedPollId}`,
        },
        () => {
          void fetchResults(selectedPollId);
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [supabase, selectedPollId, fetchResults]);

  // ----------------------------------------
  // Derived poll data
  // ----------------------------------------

  const selectedPoll = useMemo(
    () => polls.find((poll) => poll.id === selectedPollId) ?? null,
    [polls, selectedPollId]
  );

  const resultOptions = useMemo(() => {
    const counts = new Map<string, number>();

    voteRows.forEach((row) => {
      counts.set(
        row.option_id,
        (counts.get(row.option_id) ?? 0) + 1
      );
    });

    const total = voteRows.length;

    return options.map((option) => {
      const votes = counts.get(option.id) ?? 0;

      return {
        ...option,
        votes,
        percentage: total > 0 ? (votes / total) * 100 : 0,
      };
    });
  }, [options, voteRows]);

  const totalVotes = voteRows.length;

  const sortedOptions = useMemo(
    () => [...resultOptions].sort((a, b) => b.votes - a.votes),
    [resultOptions]
  );

  const winner = sortedOptions[0] ?? null;

  const filteredPolls = useMemo(() => {
    return polls.filter((poll) => {
      const matchesSearch = poll.title
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || poll.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [polls, search, statusFilter]);

  // ----------------------------------------
  // Results URL
  // ----------------------------------------

  const shareUrl =
    typeof window !== "undefined" && selectedPoll
      ? `${window.location.origin}/results/${selectedPoll.slug}`
      : "";

  // ----------------------------------------
  // Copy results link
  // ----------------------------------------

  const copyResultsLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);

      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Unable to copy the link. Please copy it manually.");
    }
  };

  // ----------------------------------------
  // Share results
  // ----------------------------------------

  const shareResults = async () => {
    if (!shareUrl || !selectedPoll) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${selectedPoll.title} | FanVerse Results`,
          text: "Check out these Telugu cinema poll results!",
          url: shareUrl,
        });
      } else {
        await copyResultsLink();
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Unable to share results.");
      }
    }
  };

  // ----------------------------------------
  // Change public results visibility
  // ----------------------------------------

  const toggleVisibility = async () => {
    if (!selectedPoll) return;

    setSavingVisibility(true);
    setError("");

    const nextValue = !selectedPoll.results_visible;

    try {
      const { error: updateError } = await supabase
        .from("polls")
        .update({ results_visible: nextValue })
        .eq("id", selectedPoll.id);

      if (updateError) throw updateError;

      setPolls((current) =>
        current.map((poll) =>
          poll.id === selectedPoll.id
            ? { ...poll, results_visible: nextValue }
            : poll
        )
      );
    } catch (err) {
      console.error("Visibility update error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update results visibility."
      );
    } finally {
      setSavingVisibility(false);
    }
  };

  // ----------------------------------------
  // Download CSV
  // ----------------------------------------

  const downloadCSV = () => {
    if (!selectedPoll) return;

    const rows = [
      ["Poll", selectedPoll.title],
      ["Status", selectedPoll.status],
      ["Total Votes", String(totalVotes)],
      [],
      ["Rank", "Option", "Votes", "Percentage"],
      ...sortedOptions.map((option, index) => [
        String(index + 1),
        option.option_text,
        String(option.votes),
        `${option.percentage.toFixed(2)}%`,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `fanverse-${selectedPoll.slug}-results.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  // ----------------------------------------
  // Generate downloadable poster
  // ----------------------------------------

  const downloadPoster = () => {
    if (!selectedPoll || !winner) {
      setError("There are no results available to create a poster.");
      return;
    }

    const canvas = document.createElement("canvas");

    const dimensions =
      format === "story"
        ? { width: 1080, height: 1920 }
        : format === "post"
          ? { width: 1080, height: 1350 }
          : format === "square"
            ? { width: 1080, height: 1080 }
            : { width: 1920, height: 1080 };

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setError("Unable to generate the poster.");
      return;
    }

    const width = canvas.width;
    const height = canvas.height;

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#25120e");
    background.addColorStop(0.5, "#10101b");
    background.addColorStop(1, "#24113b");

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";

    ctx.fillStyle = "#fb923c";
    ctx.font = "bold 36px Arial";
    ctx.fillText("FANVERSE PRESENTS", width / 2, height * 0.13);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${format === "story" ? 52 : 44}px Arial`;

    const title =
      selectedPoll.title.length > 45
        ? selectedPoll.title.slice(0, 42) + "..."
        : selectedPoll.title;

    ctx.fillText(title, width / 2, height * 0.23, width * 0.85);

    ctx.fillStyle = "#fb923c";
    ctx.font = "bold 38px Arial";
    ctx.fillText(
      template === "leaderboard"
        ? "FINAL LEADERBOARD"
        : template === "statistics"
          ? "POLL STATISTICS"
          : template === "fanbattle"
            ? "FAN BATTLE RESULTS"
            : "POLL WINNER",
      width / 2,
      height * 0.34
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 90px Arial";
    ctx.fillText(winner.option_text, width / 2, height * 0.47, width * 0.85);

    ctx.fillStyle = "#fb923c";
    ctx.font = "bold 120px Arial";
    ctx.fillText(
      `${winner.percentage.toFixed(1)}%`,
      width / 2,
      height * 0.57
    );

    ctx.fillStyle = "#d1d5db";
    ctx.font = "40px Arial";
    ctx.fillText(
      `${formatNumber(winner.votes)} votes`,
      width / 2,
      height * 0.63
    );

    if (template === "leaderboard") {
      ctx.textAlign = "left";
      ctx.font = "bold 34px Arial";

      sortedOptions.slice(0, 5).forEach((option, index) => {
        const y = height * 0.72 + index * 58;

        ctx.fillStyle = "#ffffff";
        ctx.fillText(
          `${index + 1}. ${option.option_text}`,
          width * 0.13,
          y,
          width * 0.55
        );

        ctx.textAlign = "right";
        ctx.fillText(
          `${option.percentage.toFixed(1)}%`,
          width * 0.87,
          y
        );

        ctx.textAlign = "left";
      });
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#9ca3af";
    ctx.font = "28px Arial";
    ctx.fillText(
      `TOTAL VOTES: ${formatNumber(totalVotes)}`,
      width / 2,
      height * 0.91
    );

    ctx.fillStyle = "#fb923c";
    ctx.font = "bold 28px Arial";
    ctx.fillText(
      "POWERED BY KAGE ORIGIN",
      width / 2,
      height * 0.96
    );

    const link = document.createElement("a");
    link.download = `fanverse-${selectedPoll.slug}-poster.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // ----------------------------------------
  // Loading screen
  // ----------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-white">
        <Loader2 className="animate-spin text-orange-400" size={28} />
        <span className="ml-3 text-sm text-white/50">
          Loading Results Studio...
        </span>
      </div>
    );
  }

  // ----------------------------------------
  // UI
  // ----------------------------------------

  return (
    <main className="min-h-screen bg-[#090910] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft size={17} />
            Dashboard
          </Link>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
            {realtimeConnected ? (
              <>
                <Wifi size={15} className="text-green-400" />
                <span className="text-green-400">Live Updates</span>
              </>
            ) : (
              <>
                <WifiOff size={15} className="text-gray-500" />
                <span className="text-gray-400">Realtime unavailable</span>
              </>
            )}
          </div>
        </div>

        <header className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm tracking-widest text-orange-400">
              FANVERSE ANALYTICS
            </p>

            <h1 className="mt-2 text-3xl font-bold md:text-4xl">
              Results Studio
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              Analyse poll performance and create shareable results.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadPolls();
              if (selectedPollId) {
                void fetchResults(selectedPollId, true);
              }
            }}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh Results
          </button>
        </header>

        {/* Error */}

        {error && (
          <div className="mb-6 break-words rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Poll selector */}

        <section className="glass mb-7 rounded-2xl border border-white/10 p-5 md:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold">Select a Poll</h2>
            <p className="mt-1 text-sm text-gray-400">
              Choose which poll you want to analyse.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Search Polls
              </label>

              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by poll title..."
                  className="w-full rounded-xl border border-white/10 bg-[#151520] py-3 pl-11 pr-4 text-sm outline-none focus:border-orange-400/50"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Filter by Status
              </label>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as FilterStatus)
                }
                className="w-full rounded-xl border border-white/10 bg-[#151520] px-4 py-3 text-sm outline-none"
              >
                <option value="all">All Polls</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="ended">Ended</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm text-gray-400">
              Available Polls ({filteredPolls.length})
            </label>

            <select
              value={selectedPollId}
              onChange={(e) => setSelectedPollId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#151520] px-4 py-3 text-sm outline-none focus:border-orange-400/50"
            >
              {filteredPolls.length === 0 && (
                <option value="">No matching polls</option>
              )}

              {filteredPolls.map((poll) => (
                <option key={poll.id} value={poll.id}>
                  {poll.title} — {poll.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {selectedPoll && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <p className="text-sm text-gray-300">
                Selected: <span className="font-semibold">{selectedPoll.title}</span>
              </p>

              <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400">
                {selectedPoll.status.toUpperCase()}
              </span>
            </div>
          )}
        </section>

        {!selectedPoll ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-20 text-center">
            <Vote className="mx-auto mb-4 text-gray-500" size={36} />
            <h2 className="text-xl font-bold">No Poll Selected</h2>
            <p className="mt-2 text-sm text-gray-500">
              Create a poll to start viewing results.
            </p>
            <Link
              href="/admin/polls/new"
              className="mt-5 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold hover:bg-orange-600"
            >
              Create Poll
            </Link>
          </div>
        ) : (
          <>
            {/* Statistics */}

            <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Votes",
                  value: formatNumber(totalVotes),
                  icon: Vote,
                },
                {
                  label: "Total Options",
                  value: resultOptions.length,
                  icon: ChartColumnIncreasing,
                },
                {
                  label: "Winning Votes",
                  value: formatNumber(winner?.votes ?? 0),
                  icon: Trophy,
                },
                {
                  label: "Winner Share",
                  value: `${(winner?.percentage ?? 0).toFixed(1)}%`,
                  icon: Users,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="glass rounded-2xl border border-white/10 p-5"
                  >
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-400">
                        {item.label}
                      </p>
                      <Icon size={20} className="text-orange-400" />
                    </div>

                    <p className="mt-4 text-3xl font-bold">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </section>

            {/* Results visibility */}

            <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div>
                <h2 className="font-bold">Public Results Visibility</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Control whether visitors can view this poll's results.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleVisibility}
                disabled={savingVisibility}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${
                  selectedPoll.results_visible
                    ? "border border-green-500/30 bg-green-500/10 text-green-400"
                    : "border border-red-500/30 bg-red-500/10 text-red-400"
                }`}
              >
                {savingVisibility ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : selectedPoll.results_visible ? (
                  <Eye size={17} />
                ) : (
                  <EyeOff size={17} />
                )}

                {selectedPoll.results_visible
                  ? "Public Results Enabled"
                  : "Public Results Hidden"}
              </button>
            </section>

            {/* Winner */}

            <section className="mb-8 overflow-hidden rounded-2xl border border-orange-400/20 bg-gradient-to-r from-orange-500/15 to-purple-500/10 p-6 md:p-8">
              {winner && totalVotes > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-5">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-orange-400">
                      <Trophy size={18} />
                      CURRENT POLL LEADER
                    </p>

                    <h2 className="mt-3 text-3xl font-black md:text-4xl">
                      {winner.option_text}
                    </h2>

                    <p className="mt-2 text-gray-400">
                      {formatNumber(winner.votes)} votes ·{" "}
                      {winner.percentage.toFixed(1)}% of total
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-400/20 bg-black/20 px-7 py-5 text-center">
                    <Crown
                      className="mx-auto text-orange-400"
                      size={34}
                    />
                    <p className="mt-2 text-3xl font-black">#1</p>
                    <p className="text-xs text-gray-400">Leaderboard</p>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <Trophy className="mx-auto mb-3 text-orange-400" size={34} />
                  <h2 className="text-xl font-bold">Waiting for Votes</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    Results will appear here after the first vote.
                  </p>
                </div>
              )}
            </section>

            {/* Chart */}

            <section className="glass mb-8 rounded-2xl border border-white/10 p-5 md:p-7">
              <h2 className="mb-6 text-xl font-bold">
                Vote Distribution
              </h2>

              {resultOptions.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">
                  This poll has no options yet.
                </p>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={resultOptions}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#292938"
                      />

                      <XAxis
                        dataKey="option_text"
                        stroke="#9CA3AF"
                        tick={{ fontSize: 12 }}
                      />

                      <YAxis
                        stroke="#9CA3AF"
                        tick={{ fontSize: 12 }}
                        allowDecimals={false}
                      />

                      <Tooltip
                        contentStyle={{
                          background: "#171722",
                          border: "1px solid #333344",
                          borderRadius: "12px",
                          color: "#fff",
                        }}
                      />

                      <Bar
                        dataKey="votes"
                        name="Votes"
                        fill="#F97316"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Ranking */}

            <section className="glass mb-8 rounded-2xl border border-white/10 p-5 md:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Final Rankings</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Live ranking based on recorded votes.
                  </p>
                </div>

                <span className="text-xs text-gray-500">
                  {formatNumber(totalVotes)} total votes
                </span>
              </div>

              <div className="space-y-5">
                {sortedOptions.map((option, index) => (
                  <div key={option.id}>
                    <div className="mb-2 flex justify-between gap-3">
                      <span className="font-semibold">
                        #{index + 1} {option.option_text}
                      </span>

                      <span className="text-sm text-gray-400">
                        {formatNumber(option.votes)} ·{" "}
                        {option.percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          index === 0
                            ? "bg-gradient-to-r from-orange-500 to-amber-300"
                            : "bg-gradient-to-r from-orange-500/70 to-purple-500/70"
                        }`}
                        style={{ width: `${option.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Share and export */}

            <section className="glass rounded-2xl border border-white/10 p-5 md:p-7">
              <div className="mb-7">
                <p className="text-sm font-semibold tracking-widest text-orange-400">
                  SOCIAL MEDIA
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Create Shareable Results
                </h2>

                <p className="mt-2 text-sm text-gray-400">
                  Generate a FanVerse poster or export the poll data.
                </p>
              </div>

              <div className="mb-6 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Poster Template
                  </label>

                  <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#151520] px-4 py-3"
                  >
                    <option value="winner">Winner Announcement</option>
                    <option value="leaderboard">Full Leaderboard</option>
                    <option value="statistics">Statistics Card</option>
                    <option value="fanbattle">Fan Battle Poster</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Social Media Format
                  </label>

                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#151520] px-4 py-3"
                  >
                    <option value="story">Instagram Story · 9:16</option>
                    <option value="post">Instagram Post · 4:5</option>
                    <option value="square">Square · 1:1</option>
                    <option value="landscape">Landscape · 16:9</option>
                  </select>
                </div>
              </div>

              {/* Poster preview */}

              <div className="mb-6 flex justify-center rounded-2xl border border-white/10 bg-black/30 p-5">
                <div
                  className={`flex flex-col items-center justify-center overflow-hidden rounded-xl border border-orange-400/30 bg-gradient-to-br from-[#25120e] via-[#11111c] to-[#24113b] p-6 text-center ${
                    format === "story"
                      ? "aspect-[9/16] w-56"
                      : format === "post"
                        ? "aspect-[4/5] w-64"
                        : format === "square"
                          ? "aspect-square w-64"
                          : "aspect-video w-full max-w-lg"
                  }`}
                >
                  <p className="text-xs font-bold tracking-[0.3em] text-orange-400">
                    FANVERSE PRESENTS
                  </p>

                  <Trophy
                    size={format === "story" ? 42 : 34}
                    className="my-5 text-orange-400"
                  />

                  <p className="text-xs uppercase tracking-widest text-gray-300">
                    {template === "leaderboard"
                      ? "FINAL LEADERBOARD"
                      : template === "statistics"
                        ? "POLL STATISTICS"
                        : template === "fanbattle"
                          ? "FAN BATTLE RESULTS"
                          : "POLL WINNER"}
                  </p>

                  <h3 className="mt-4 text-xl font-black">
                    {winner && totalVotes > 0
                      ? winner.option_text
                      : "Awaiting Votes"}
                  </h3>

                  <p className="mt-2 text-3xl font-black text-orange-400">
                    {winner && totalVotes > 0
                      ? `${winner.percentage.toFixed(1)}%`
                      : "0%"}
                  </p>

                  <p className="mt-2 text-xs text-gray-300">
                    {formatNumber(winner?.votes ?? 0)} votes
                  </p>

                  {template === "leaderboard" && (
                    <div className="mt-5 w-full space-y-2 text-left text-xs">
                      {sortedOptions.map((option, index) => (
                        <div
                          key={option.id}
                          className="flex justify-between gap-2"
                        >
                          <span>
                            {index + 1}. {option.option_text}
                          </span>
                          <span>{option.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto pt-6 text-[10px] tracking-widest text-gray-400">
                    POWERED BY KAGE ORIGIN
                  </div>
                </div>
              </div>

              {/* Export buttons */}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadPoster}
                  disabled={!winner || totalVotes === 0}
                  className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download size={17} />
                  Download PNG Poster
                </button>

                <button
                  type="button"
                  onClick={downloadCSV}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5"
                >
                  <ChartColumnIncreasing size={17} />
                  Export CSV
                </button>

                <button
                  type="button"
                  onClick={shareResults}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5"
                >
                  <Share2 size={17} />
                  Share Results
                </button>

                <button
                  type="button"
                  onClick={copyResultsLink}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5"
                >
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                  {copied ? "Copied" : "Copy Results Link"}
                </button>
              </div>
            </section>
          </>
        )}

        <p className="mt-8 text-center text-xs text-gray-600">
          FanVerse Results Studio · Powered by Kage Origin
        </p>
      </div>
    </main>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}
