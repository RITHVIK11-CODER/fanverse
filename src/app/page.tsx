
import Navbar from "@/components/layout/navbar";
import PollCard from "@/components/polls/poll-card";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, Flame, Sparkles } from "lucide-react";
import type { Poll } from "@/types/poll";
import { connection } from "next/server";

export const instant = false;

type HomepagePollRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  cover_image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  results_visible: boolean;
  categories:
    | { name: string }
    | { name: string }[]
    | null;
  poll_options: {
    id: string;
    option_text: string;
    image_url: string | null;
    display_order: number;
  }[] | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

type ResultRow = {
  option_id: string;
  vote_count: number | string;
};

function getCategoryName(
  categories: HomepagePollRow["categories"]
) {
  if (Array.isArray(categories)) {
    return categories[0]?.name ?? "Telugu Cinema";
  }

  return categories?.name ?? "Telugu Cinema";
}

function getEndsIn(endsAt: string | null) {
  if (!endsAt) return "No end date";

  const difference =
    new Date(endsAt).getTime() - Date.now();

  if (difference <= 0) return "Ended";

  const days = Math.floor(
    difference / (1000 * 60 * 60 * 24)
  );

  const hours = Math.floor(
    (difference / (1000 * 60 * 60)) % 24
  );

  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"} left`;
  }

  return `${hours} hour${hours === 1 ? "" : "s"} left`;
}

function getCategoryEmoji(icon: string | null) {
  const icons: Record<string, string> = {
    film: "🎬",
    trophy: "🏆",
    music: "🎵",
    mic: "🎤",
    game: "🎮",
  };

  return icons[icon ?? ""] ?? "✨";
}

export default async function Home() {
  // Render database and time-dependent data at request time.
  await connection();

  const supabase = await createClient();

  const now = new Date().toISOString();

  const [pollResponse, categoryResponse] =
    await Promise.all([
      supabase
        .from("polls")
        .select(`
          id,
          slug,
          title,
          description,
          status,
          cover_image,
          starts_at,
          ends_at,
          results_visible,
          categories(name),
          poll_options(
            id,
            option_text,
            image_url,
            display_order
          )
        `)
        .eq("status", "active")
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(9),

      supabase
        .from("categories")
        .select("id, name, slug, icon")
        .eq("is_enabled", true)
        .order("name"),
    ]);

  const pollError = pollResponse.error;
  const categoryError = categoryResponse.error;

  const pollRows = (
    pollResponse.data ?? []
  ) as unknown as HomepagePollRow[];

  const categories = (
    categoryResponse.data ?? []
  ) as CategoryRow[];

  const activePolls: Poll[] = await Promise.all(
    pollRows.map(async (poll) => {
      let totalVotes: number | null = null;

      // Only retrieve counts when results are visible.
      if (poll.results_visible) {
        const { data: resultRows, error } =
          await supabase.rpc("get_poll_results", {
            p_poll_id: poll.id,
          });

        if (!error) {
          const rows = (resultRows ?? []) as ResultRow[];

          totalVotes = rows.reduce(
            (total, row) =>
              total + Number(row.vote_count),
            0
          );
        }
      }

      const options = [...(poll.poll_options ?? [])]
        .sort(
          (a, b) =>
            a.display_order - b.display_order
        )
        .map((option) => ({
          id: option.id,
          name: option.option_text,
          image: option.image_url ?? "",
          votes: 0,
        }));

      return {
        id: poll.id,
        slug: poll.slug,
        title: poll.title,
        category: getCategoryName(poll.categories),
        status: "active",
        cover:
          poll.cover_image ??
          "https://placehold.co/600x400/211b36/ffffff?text=FanVerse+Poll",
        totalVotes,
        endsIn: getEndsIn(poll.ends_at),
        options,
      };
    })
  );

  const categoryIcons = new Map(
    categories.map((category) => [
      category.id,
      getCategoryEmoji(category.icon),
    ])
  );

  return (
    <main className="min-h-screen">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden px-5 py-24 md:py-36">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px]" />

        <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl text-center">
          <div className="glass mx-auto mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-amber-300">
            <Sparkles size={15} />
            THE HOME OF TELUGU CINEMA FANS
          </div>

          <h1 className="text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
            YOUR FAVOURITE.
            <br />
            <span className="text-gradient">
              YOUR VOTE.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-sm leading-7 text-gray-400 md:text-lg">
            Celebrate Telugu cinema. Vote for your favourite
            stars, movies and moments. Every fan has a voice.
          </p>

          <a
            href="#polls"
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-amber-500 px-8 py-4 font-bold text-black transition hover:scale-105 hover:bg-amber-400"
          >
            Explore Polls <ArrowRight size={18} />
          </a>

          <div className="mt-16 grid grid-cols-3 gap-3">
            {[
              ["LIVE", "Voting polls"],
              ["TELUGU", "Cinema community"],
              ["FREE", "Public voting"],
            ].map(([value, label]) => (
              <div key={value} className="glass rounded-xl p-4">
                <p className="text-lg font-bold text-amber-400 md:text-2xl">
                  {value}
                </p>
                <p className="mt-1 text-[10px] text-gray-400 md:text-xs">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE POLLS */}
      <section
        id="polls"
        className="mx-auto max-w-7xl px-5 py-16"
      >
        <div className="mb-9 flex items-center justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-400">
              <Flame size={17} />
              TRENDING NOW
            </p>

            <h2 className="text-3xl font-bold md:text-4xl">
              Popular Polls
            </h2>
          </div>

          <span className="text-sm text-gray-500">
            {activePolls.length} active
          </span>
        </div>

        {pollError ? (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-red-400">
              Unable to load polls from the database.
            </p>

            <p className="mt-2 text-xs text-gray-500">
              Please check Supabase permissions and connection.
            </p>
          </div>
        ) : activePolls.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Sparkles
              className="mx-auto mb-4 text-amber-400"
              size={32}
            />

            <h3 className="text-xl font-semibold">
              No active polls right now
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              New FanVerse polls will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activePolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </div>
        )}
      </section>

      {/* CATEGORIES */}
      <section
        id="categories"
        className="mx-auto max-w-7xl px-5 py-16"
      >
        <h2 className="mb-8 text-3xl font-bold">
          Explore Categories
        </h2>

        {categoryError ? (
          <p className="text-sm text-red-400">
            Unable to load categories.
          </p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-400">
            No categories available.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className="glass rounded-xl p-6 text-center transition hover:-translate-y-1 hover:border-amber-400/40"
              >
                <div className="mb-3 text-3xl">
                  {categoryIcons.get(category.id)}
                </div>

                <p className="text-sm font-semibold">
                  {category.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-5 py-10 text-center">
        <p className="text-xl font-extrabold">
          FAN<span className="text-amber-400">VERSE</span>
        </p>

        <p className="mt-3 text-xs text-gray-500">
          Your Favourite. Your Vote. Your Voice.
        </p>

        <p className="mt-5 text-xs text-gray-600">
          © 2026 FanVerse. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
