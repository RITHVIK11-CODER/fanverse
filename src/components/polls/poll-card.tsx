
import Link from "next/link";
import Image from "next/image";
import { Clock3, Users } from "lucide-react";
import type { Poll } from "@/types/poll";

export default function PollCard({ poll }: { poll: Poll }) {
  return (
    <Link href={`/polls/${poll.slug}`}>
      <article className="glass group overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1 hover:border-amber-400/40">
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={poll.cover}
            alt={poll.title}
            fill
            unoptimized
            className="object-cover transition duration-500 group-hover:scale-105"
          />

          <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md">
            {poll.status.toUpperCase()}
          </span>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-xs font-medium text-purple-300">
            {poll.category}
          </p>

          <h3 className="line-clamp-2 min-h-14 text-lg font-semibold text-white">
            {poll.title}
          </h3>

          <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Users size={14} />
              {poll.totalVotes === null
                ? "Results hidden"
                : `${poll.totalVotes.toLocaleString("en-IN")} votes`}
            </span>

            <span className="flex items-center gap-1">
              <Clock3 size={14} />
              {poll.endsIn ?? "Voting open"}
            </span>
          </div>

          <div className="w-full rounded-full bg-white/10 py-2.5 text-center text-sm font-semibold text-amber-300 transition group-hover:bg-amber-500 group-hover:text-black">
            View Poll →
          </div>
        </div>
      </article>
    </Link>
  );
}
