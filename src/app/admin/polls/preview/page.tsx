
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  CalendarDays,
  Users,
  CheckCircle2,
} from "lucide-react";

const demoPoll = {
  title: "Who is the biggest Telugu superstar?",
  description:
    "Vote for your favourite Telugu cinema superstar. Every option can receive one vote from each visitor.",
  category: "Actors",
  status: "active",
  options: [
    {
      id: "1",
      name: "Allu Arjun",
      image: "https://placehold.co/500x600/191923/ffffff?text=Allu+Arjun",
      votes: 1200,
    },
    {
      id: "2",
      name: "Prabhas",
      image: "https://placehold.co/500x600/191923/ffffff?text=Prabhas",
      votes: 980,
    },
    {
      id: "3",
      name: "Mahesh Babu",
      image: "https://placehold.co/500x600/191923/ffffff?text=Mahesh+Babu",
      votes: 850,
    },
    {
      id: "4",
      name: "Pawan Kalyan",
      image: "https://placehold.co/500x600/191923/ffffff?text=Pawan+Kalyan",
      votes: 760,
    },
  ],
};

export default function PollPreviewPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const totalVotes = demoPoll.options.reduce(
    (total, option) => total + option.votes,
    0
  );

  const toggleOption = (id: string) => {
    if (submitted) return;

    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const handleVote = () => {
    if (selected.length === 0) return;
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-[#090910] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/polls/new"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to Create Poll
          </Link>

          <span className="flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-400">
            <Eye size={15} />
            ADMIN PREVIEW
          </span>
        </div>

        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-400">
            FanVerse Polls
          </p>

          <h1 className="mt-4 text-3xl font-black md:text-5xl">
            {demoPoll.title}
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-gray-400">
            {demoPoll.description}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm text-gray-400">
            <span>{demoPoll.category}</span>
            <span className="flex items-center gap-1">
              <Users size={15} />
              {totalVotes.toLocaleString()} votes
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays size={15} />
              Preview mode
            </span>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {demoPoll.options.map((option) => {
            const isSelected = selected.includes(option.id);
            const percentage = Math.round(
              (option.votes / totalVotes) * 100
            );

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleOption(option.id)}
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  isSelected
                    ? "border-orange-400 bg-orange-500/10"
                    : "border-white/10 bg-white/[0.04] hover:border-white/30"
                }`}
              >
                <div className="relative">
                  <img
                    src={option.image}
                    alt={option.name}
                    className="h-64 w-full object-cover"
                  />

                  {isSelected && (
                    <span className="absolute right-4 top-4 rounded-full bg-orange-500 p-2">
                      <CheckCircle2 size={18} />
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold">
                      {option.name}
                    </h2>

                    <span className="text-sm text-gray-400">
                      {percentage}%
                    </span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-purple-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-8 max-w-md text-center">
          <p className="mb-4 text-sm text-gray-400">
            Select multiple options to test the voting experience.
          </p>

          <button
            onClick={handleVote}
            disabled={selected.length === 0 || submitted}
            className="w-full rounded-xl bg-orange-500 px-6 py-4 font-bold transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitted
              ? "Preview Vote Submitted"
              : `Preview Vote (${selected.length} selected)`}
          </button>

          {submitted && (
            <p className="mt-3 text-sm text-green-400">
              Preview interaction completed. No real votes were recorded.
            </p>
          )}
        </div>

        <p className="mt-10 text-center text-xs text-gray-600">
          FanVerse · Powered by Kage Origin
        </p>
      </div>
    </main>
  );
}
