
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Trophy,
  Vote,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PollOption = {
  id: string;
  option_text: string;
  image_url: string | null;
  display_order: number;
};

type PollResult = {
  option_id: string;
  vote_count: number;
};

type ReactionCount = {
  reaction: string;
  reaction_count: number;
};

type FloatingReaction = {
  id: string;
  emoji: string;
  left: number;
};

type PollData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "scheduled" | "active" | "paused" | "ended";
  cover_image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  results_visible: boolean;
  options: PollOption[];
};

type PollDetailsProps = {
  poll: PollData;
};

const REACTIONS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "😂", label: "Funny" },
  { emoji: "😍", label: "Adore" },
  { emoji: "👏", label: "Applause" },
];

export default function PollDetails({ poll }: PollDetailsProps) {
  const [voterToken, setVoterToken] = useState("");
  const [identityReady, setIdentityReady] = useState(false);

  const [votedOptions, setVotedOptions] = useState<string[]>([]);
  const [results, setResults] = useState<PollResult[]>([]);
  const [reactionCounts, setReactionCounts] = useState<ReactionCount[]>([]);

  const [floatingReactions, setFloatingReactions] = useState<
    FloatingReaction[]
  >([]);

  const [showResults, setShowResults] = useState(false);
  const [votingOption, setVotingOption] = useState<string | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [currentTime, setCurrentTime] = useState<number | null>(null);

  // ----------------------------------------
  // Browser identity
  // ----------------------------------------

  useEffect(() => {
    let token = localStorage.getItem("fanverse-voter-token");

    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("fanverse-voter-token", token);
    }

    setVoterToken(token);

    const savedVotes = localStorage.getItem(
      `fanverse-votes-${poll.id}`
    );

    if (savedVotes) {
      try {
        const parsed = JSON.parse(savedVotes);

        if (Array.isArray(parsed)) {
          setVotedOptions(parsed);
        }
      } catch {
        localStorage.removeItem(`fanverse-votes-${poll.id}`);
      }
    }

    setCurrentTime(Date.now());
    setIdentityReady(true);
  }, [poll.id]);

  // ----------------------------------------
  // Current time
  // ----------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // ----------------------------------------
  // Poll status
  // ----------------------------------------

  const isUpcoming =
    poll.starts_at !== null &&
    currentTime !== null &&
    new Date(poll.starts_at).getTime() > currentTime;

  const isExpired =
    poll.ends_at !== null &&
    currentTime !== null &&
    new Date(poll.ends_at).getTime() <= currentTime;

  const isOpen =
    poll.status === "active" &&
    !isUpcoming &&
    !isExpired;

  const reactionsAvailable =
    poll.status === "active" || poll.status === "ended";

  // ----------------------------------------
  // Results calculations
  // ----------------------------------------

  const totalVotes = results.reduce(
    (total, item) => total + Number(item.vote_count || 0),
    0
  );

  const getVotes = (optionId: string) => {
    return Number(
      results.find((item) => item.option_id === optionId)?.vote_count || 0
    );
  };

  const getPercentage = (optionId: string) => {
    if (totalVotes === 0) return 0;

    return Math.round((getVotes(optionId) / totalVotes) * 100);
  };

  const getReactionCount = (emoji: string) => {
    return Number(
      reactionCounts.find((item) => item.reaction === emoji)
        ?.reaction_count || 0
    );
  };

  // ----------------------------------------
  // Fetch results and reactions
  // ----------------------------------------

  const refreshAll = useCallback(async () => {
    const supabase = createClient();

    if (poll.results_visible) {
      const { data, error } = await supabase.rpc("get_poll_results", {
        p_poll_id: poll.id,
      });

      if (error) {
        console.error("Could not load poll results:", error.message);
      } else if (data) {
        setResults(
          (data as PollResult[]).map((item) => ({
            ...item,
            vote_count: Number(item.vote_count),
          }))
        );
      }
    }

    if (poll.status === "active" || poll.status === "ended") {
      const { data, error } = await supabase.rpc("get_poll_reactions", {
        p_poll_id: poll.id,
      });

      if (error) {
        console.error("Could not load reactions:", error.message);
      } else if (data) {
        setReactionCounts(
          (data as ReactionCount[]).map((item) => ({
            ...item,
            reaction_count: Number(item.reaction_count),
          }))
        );
      }
    }
  }, [poll.id, poll.results_visible, poll.status]);

  // ----------------------------------------
  // Supabase Realtime: Live reactions
  // ----------------------------------------

  useEffect(() => {
    const supabase = createClient();

    let isMounted = true;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshLiveData = async () => {
      if (poll.results_visible) {
        const { data, error } = await supabase.rpc(
          "get_poll_results",
          {
            p_poll_id: poll.id,
          }
        );

        if (!isMounted) return;

        if (error) {
          console.error(
            "Realtime results refresh failed:",
            error.message
          );
        } else if (data) {
          setResults(
            (data as PollResult[]).map((item) => ({
              ...item,
              vote_count: Number(item.vote_count),
            }))
          );
        }
      }

      if (poll.status === "active" || poll.status === "ended") {
        const { data, error } = await supabase.rpc(
          "get_poll_reactions",
          {
            p_poll_id: poll.id,
          }
        );

        if (!isMounted) return;

        if (error) {
          console.error(
            "Realtime reactions refresh failed:",
            error.message
          );
        } else if (data) {
          setReactionCounts(
            (data as ReactionCount[]).map((item) => ({
              ...item,
              reaction_count: Number(item.reaction_count),
            }))
          );
        }
      }
    };

    // Debounce count refreshes when many events arrive together.
    const scheduleRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        void refreshLiveData();
      }, 200);
    };

    // Initial results and reaction counts.
    void refreshLiveData();

    // Listen for every new poll activity event.
    const channel = supabase
      .channel(`poll-activity-${poll.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_activity",
          filter: `poll_id=eq.${poll.id}`,
        },
        (payload) => {
          const activity = payload.new as {
            event_type?: string;
            reaction?: string | null;
          };

          // Animate reactions for every connected visitor.
          if (
            activity.event_type === "reaction" &&
            activity.reaction &&
            REACTIONS.some(
              (item) => item.emoji === activity.reaction
            )
          ) {
            setFloatingReactions((previous) => [
              ...previous,
              {
                id: crypto.randomUUID(),
                emoji: activity.reaction!,
                left: 35 + Math.random() * 30,
              },
            ]);
          }

          // Update live counts.
          scheduleRefresh();
        }
      )
      .subscribe((status) => {
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.error(
            "Poll Realtime connection issue:",
            status
          );
        }

        if (status === "SUBSCRIBED") {
          console.log("FanVerse live reactions connected!");
        }
      });

    return () => {
      isMounted = false;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [poll.id, poll.results_visible, poll.status]);

  // ----------------------------------------
  // Vote handler
  // ----------------------------------------

  const handleVote = async (optionId: string) => {
    if (!identityReady || !voterToken) return;

    if (!isOpen) {
      setMessage("Voting is currently unavailable.");
      setMessageType("error");
      return;
    }

    if (votedOptions.includes(optionId)) {
      setMessage("You have already voted for this option.");
      setMessageType("info");
      return;
    }

    setVotingOption(optionId);
    setMessage("");

    try {
      const response = await fetch("/api/polls/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pollId: poll.id,
          optionId,
          voterToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to submit your vote."
        );
      }

      if (data.inserted) {
        const updatedVotes = [...votedOptions, optionId];

        setVotedOptions(updatedVotes);

        localStorage.setItem(
          `fanverse-votes-${poll.id}`,
          JSON.stringify(updatedVotes)
        );

        setMessage("Your vote has been submitted successfully!");
        setMessageType("success");
      } else {
        setMessage(
          data.message || "You have already voted for this option."
        );
        setMessageType("info");
      }

      if (data.results) {
        setResults(
          (data.results as PollResult[]).map((item) => ({
            ...item,
            vote_count: Number(item.vote_count),
          }))
        );
      } else {
        await refreshAll();
      }

      setShowResults(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
      setMessageType("error");
    } finally {
      setVotingOption(null);
    }
  };

  // ----------------------------------------
  // Reaction handler
  // ----------------------------------------

  const handleReaction = async (emoji: string) => {
    if (!voterToken || !identityReady || !reactionsAvailable) {
      return;
    }

    if (reactionLoading) return;

    setReactionLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/polls/reaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pollId: poll.id,
          voterToken,
          reaction: emoji,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to add reaction."
        );
      }

      if (data.counts) {
        setReactionCounts(
          (data.counts as ReactionCount[]).map((item) => ({
            ...item,
            reaction_count: Number(item.reaction_count),
          }))
        );
      } else {
        await refreshAll();
      }

      // The floating animation is triggered by the Realtime event.
      setMessage("Reaction added!");
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not add reaction."
      );
      setMessageType("error");
    } finally {
      setReactionLoading(false);
    }
  };

  // ----------------------------------------
  // Remove completed floating animations
  // ----------------------------------------

  const removeFloatingReaction = (id: string) => {
    setFloatingReactions((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  // ----------------------------------------
  // Manual refresh
  // ----------------------------------------

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  // ----------------------------------------
  // End date label
  // ----------------------------------------

  const endsLabel = () => {
    if (!poll.ends_at) return "No end date";

    return new Date(poll.ends_at).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const statusLabel = isUpcoming
    ? "Upcoming"
    : isExpired
      ? "Ended"
      : poll.status.charAt(0).toUpperCase() +
        poll.status.slice(1);

  const statusColor = isOpen
    ? "bg-green-500/15 text-green-400"
    : isUpcoming
      ? "bg-blue-500/15 text-blue-400"
      : "bg-white/10 text-white/60";

  // ----------------------------------------
  // UI
  // ----------------------------------------

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Poll header */}

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">

          {poll.cover_image && (
            <div className="relative h-48 overflow-hidden sm:h-72">
              <img
                src={poll.cover_image}
                alt={poll.title}
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b12] via-black/30 to-transparent" />
            </div>
          )}

          <div className="p-5 sm:p-8">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <span
                className={`rounded-full px-4 py-1.5 text-xs font-semibold ${statusColor}`}
              >
                {statusLabel}
              </span>

              <div className="flex items-center gap-2 text-sm text-white/50">
                <Clock3 size={15} />
                <span>Ends: {endsLabel()}</span>
              </div>
            </div>

            <h1 className="text-2xl font-bold leading-tight sm:text-4xl">
              {poll.title}
            </h1>

            {poll.description && (
              <p className="mt-4 max-w-3xl leading-7 text-white/60">
                {poll.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/50">
              <span className="flex items-center gap-2">
                <Vote size={16} />
                {totalVotes.toLocaleString("en-IN")} votes
              </span>

              <span className="flex items-center gap-2">
                <Trophy size={16} />
                {poll.options.length} options
              </span>
            </div>
          </div>
        </div>

        {/* Options */}

        <section className="mt-10">

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">
                Choose your favourite
              </h2>

              <p className="mt-1 text-sm text-white/45">
                You can vote once for each option.
              </p>
            </div>

            {poll.results_visible && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowResults((previous) => !previous)}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm transition hover:bg-white/10"
                >
                  {showResults ? "Hide Results" : "View Results"}
                </button>

                <Link
                  href={`/results/${poll.slug}`}
                  className="rounded-xl border border-orange-400/30 px-4 py-2 text-sm text-orange-300 transition hover:bg-orange-500/10"
                >
                  Full Results
                </Link>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            {poll.options.map((option) => {
              const hasVoted = votedOptions.includes(option.id);
              const votes = getVotes(option.id);
              const percentage = getPercentage(option.id);
              const isVoting = votingOption === option.id;

              return (
                <div
                  key={option.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-orange-400/30"
                >
                  <div className="relative h-52 overflow-hidden bg-white/5">

                    {option.image_url ? (
                      <img
                        src={option.image_url}
                        alt={option.option_text}
                        className="h-full w-full object-cover transition duration-500 hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl font-bold text-white/20">
                        {option.option_text.charAt(0)}
                      </div>
                    )}

                    {hasVoted && (
                      <div className="absolute right-3 top-3 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
                        Voted
                      </div>
                    )}
                  </div>

                  <div className="p-5">

                    <h3 className="text-lg font-semibold">
                      {option.option_text}
                    </h3>

                    {showResults && poll.results_visible && (
                      <div className="mt-4">

                        <div className="mb-2 flex justify-between text-sm">
                          <span className="text-white/50">
                            {votes.toLocaleString("en-IN")} votes
                          </span>

                          <span className="font-semibold text-orange-400">
                            {percentage}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={
                        !identityReady ||
                        !isOpen ||
                        hasVoted ||
                        votingOption !== null
                      }
                      onClick={() => handleVote(option.id)}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-3 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isVoting ? (
                        <>
                          <Loader2 size={17} className="animate-spin" />
                          Submitting...
                        </>
                      ) : hasVoted ? (
                        <>
                          <CheckCircle2 size={17} />
                          Voted
                        </>
                      ) : (
                        <>
                          <Vote size={17} />
                          Vote Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {!isOpen && (
            <p className="mt-5 text-center text-sm text-white/45">
              {isUpcoming
                ? "This poll has not started yet."
                : "Voting is currently closed for this poll."}
            </p>
          )}
        </section>

        {/* Message */}

        {message && (
          <div
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              messageType === "success"
                ? "border-green-500/20 bg-green-500/10 text-green-300"
                : messageType === "error"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-white/10 bg-white/5 text-white/70"
            }`}
          >
            {message}
          </div>
        )}

        {/* Live reactions */}

        {reactionsAvailable && (
          <section className="relative mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">

            {/* Realtime floating emoji layer */}

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {floatingReactions.map((item) => (
                <span
                  key={item.id}
                  onAnimationEnd={() =>
                    removeFloatingReaction(item.id)
                  }
                  className="animate-fan-reaction absolute bottom-8 text-3xl sm:text-4xl"
                  style={{ left: `${item.left}%` }}
                >
                  {item.emoji}
                </span>
              ))}
            </div>

            <div className="relative z-10 text-center">

              <h2 className="text-xl font-bold sm:text-2xl">
                Show your fan energy!
              </h2>

              <p className="mt-2 text-sm text-white/45">
                React to this poll and let everyone see your fan energy.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">

                {REACTIONS.map((item) => (
                  <button
                    key={item.emoji}
                    type="button"
                    disabled={reactionLoading || !identityReady}
                    onClick={() => handleReaction(item.emoji)}
                    className="group flex min-w-[78px] flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 transition hover:-translate-y-1 hover:border-orange-400/40 hover:bg-orange-500/10 disabled:cursor-wait disabled:opacity-60"
                    title={item.label}
                  >
                    <span className="text-3xl transition group-hover:scale-125">
                      {item.emoji}
                    </span>

                    <span className="text-xs text-white/60">
                      {item.label}
                    </span>

                    <span className="text-sm font-bold text-orange-300">
                      {getReactionCount(item.emoji).toLocaleString("en-IN")}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-5 text-xs text-white/35">
                Every click counts as a new reaction. Counts update live.
              </p>
            </div>
          </section>
        )}

        {/* Results refresh */}

        {poll.results_visible && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">

            <div>
              <p className="font-semibold">Live Poll Results</p>

              <p className="mt-1 text-xs text-white/40">
                Results update when new votes are submitted.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
