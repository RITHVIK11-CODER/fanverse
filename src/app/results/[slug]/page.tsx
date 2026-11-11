
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  LockKeyhole,
  Trophy,
  Vote,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import ShareResults from "@/components/polls/share-results";
export const instant = false;
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

type Poll = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  cover_image: string | null;
  results_visible: boolean;
  created_at: string;
  ends_at: string | null;
};

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "Not specified";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PublicResultsPage({
  params,
}: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get poll
  const { data: pollData, error: pollError } = await supabase
    .from("polls")
    .select(`
      id,
      title,
      slug,
      description,
      status,
      cover_image,
      results_visible,
      created_at,
      ends_at
    `)
    .eq("slug", slug)
    .in("status", ["active", "ended"])
    .maybeSingle();

  if (pollError) {
    console.error("Results page poll error:", pollError.message);
  }

  if (!pollData) {
    notFound();
  }

  const poll = pollData as Poll;

  // Get options
  const { data: optionsData, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, option_text, image_url, display_order")
    .eq("poll_id", poll.id)
    .order("display_order", { ascending: true });

  if (optionsError) {
    console.error("Results page options error:", optionsError.message);
  }

  const options = (optionsData || []) as PollOption[];

  // Results are only fetched when public visibility is enabled.
  let results: PollResult[] = [];

  if (poll.results_visible) {
    const { data, error } = await supabase.rpc("get_poll_results", {
      p_poll_id: poll.id,
    });

    if (error) {
      console.error("Results RPC error:", error.message);
    } else {
      results = (data || []) as PollResult[];
    }
  }

  const totalVotes = results.reduce(
    (total, item) => total + Number(item.vote_count || 0),
    0
  );

  const rankedOptions = options
    .map((option) => {
      const votes = Number(
        results.find((result) => result.option_id === option.id)
          ?.vote_count || 0
      );

      const percentage =
        totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

      return {
        ...option,
        votes,
        percentage,
      };
    })
    .sort((a, b) => b.votes - a.votes);

  const winner =
    totalVotes > 0 ? rankedOptions[0] : null;

  const isEnded = poll.status === "ended";

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Navigation */}

        <Link
          href={`/polls/${poll.slug}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-orange-400"
        >
          <ArrowLeft size={16} />
          Back to Poll
        </Link>

        {/* Header */}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">

          {poll.cover_image && (
            <div className="relative h-48 sm:h-72">
              <img
                src={poll.cover_image}
                alt={poll.title}
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b12] via-black/30 to-transparent" />
            </div>
          )}

          <div className="p-5 sm:p-8">

            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                FANVERSE RESULTS
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isEnded
                    ? "bg-white/10 text-white/60"
                    : "bg-green-500/10 text-green-300"
                }`}
              >
                {isEnded ? "Poll Ended" : "Live Poll"}
              </span>
            </div>

            <h1 className="text-2xl font-bold leading-tight sm:text-4xl">
              {poll.title}
            </h1>

            {poll.description && (
              <p className="mt-4 max-w-3xl leading-7 text-white/55">
                {poll.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-white/45">
              <span className="flex items-center gap-2">
                <Vote size={16} />
                {totalVotes.toLocaleString("en-IN")} votes
              </span>

              <span className="flex items-center gap-2">
                <CalendarDays size={16} />
                Created {formatDate(poll.created_at)}
              </span>
            </div>
          </div>
        </section>

        {/* Private results */}

        {!poll.results_visible ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center sm:p-12">
            <LockKeyhole
              size={42}
              className="mx-auto text-orange-400"
            />

            <h2 className="mt-5 text-xl font-bold">
              Results are private
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">
              The administrator has not enabled public results for this poll.
              Please check back later.
            </p>

            <Link
              href={`/polls/${poll.slug}`}
              className="mt-7 inline-flex rounded-xl border border-white/10 px-5 py-3 text-sm transition hover:bg-white/5"
            >
              View Poll
            </Link>
          </section>
        ) : (
          <>
            {/* Summary */}

            <section className="mt-8 grid gap-4 sm:grid-cols-2">

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm text-white/45">
                  Total Votes
                </p>

                <p className="mt-3 text-3xl font-bold">
                  {totalVotes.toLocaleString("en-IN")}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm text-white/45">
                  Number of Options
                </p>

                <p className="mt-3 text-3xl font-bold">
                  {options.length}
                </p>
              </div>
            </section>

            {/* Winner */}

            {winner && (
              <section className="relative mt-8 overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-orange-500/[0.06] to-transparent p-6 sm:p-8">

                <div className="absolute -right-8 -top-8 opacity-10">
                  <Trophy size={150} />
                </div>

                <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">

                  {winner.image_url && (
                    <img
                      src={winner.image_url}
                      alt={winner.option_text}
                      className="h-28 w-28 rounded-2xl object-cover"
                    />
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                      <Crown size={18} />
                      CURRENT WINNER
                    </div>

                    <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                      {winner.option_text}
                    </h2>

                    <p className="mt-2 text-white/55">
                      {winner.votes.toLocaleString("en-IN")} votes
                      {" · "}
                      {winner.percentage.toFixed(1)}% of total votes
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Ranking */}

            <section className="mt-10">

              <div className="mb-6">
                <h2 className="text-xl font-bold sm:text-2xl">
                  Complete Results
                </h2>

                <p className="mt-2 text-sm text-white/45">
                  All options ranked by their vote count.
                </p>
              </div>

              <div className="space-y-4">
                {rankedOptions.map((option, index) => (
                  <article
                    key={option.id}
                    className={`overflow-hidden rounded-2xl border bg-white/[0.04] ${
                      index === 0 && totalVotes > 0
                        ? "border-amber-400/30"
                        : "border-white/10"
                    }`}
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">

                      <div className="flex items-center gap-3 sm:w-12">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            index === 0 && totalVotes > 0
                              ? "bg-amber-400 text-black"
                              : "bg-white/10 text-white/70"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </div>

                      {option.image_url ? (
                        <img
                          src={option.image_url}
                          alt={option.option_text}
                          className="h-24 w-full rounded-xl object-cover sm:h-20 sm:w-28"
                        />
                      ) : (
                        <div className="flex h-20 w-full items-center justify-center rounded-xl bg-white/5 text-2xl font-bold text-white/30 sm:w-28">
                          {option.option_text.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold">
                            {option.option_text}
                          </h3>

                          <span className="text-lg font-bold text-orange-300">
                            {option.percentage.toFixed(1)}%
                          </span>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              index === 0
                                ? "bg-gradient-to-r from-amber-400 to-orange-500"
                                : "bg-gradient-to-r from-violet-500 to-purple-400"
                            }`}
                            style={{
                              width: `${option.percentage}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-xs text-white/45">
                          {option.votes.toLocaleString("en-IN")} votes
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {totalVotes === 0 && (
                <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center text-sm text-white/50">
                  No votes have been submitted yet.
                </p>
              )}
            </section>

            {/* Share */}

            <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center sm:p-8">
              <h2 className="text-xl font-bold">
                Share the FanVerse Results
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
                Let your friends and fellow Telugu cinema fans see the poll
                results.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ShareResults
                  title={poll.title}
                  slug={poll.slug}
                />

                <Link
                  href={`/polls/${poll.slug}`}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/5"
                >
                  View Poll
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
