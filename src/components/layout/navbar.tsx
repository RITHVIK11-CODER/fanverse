
import Link from "next/link";
import { Clapperboard } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b12]/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Clapperboard className="text-amber-400" size={28} />
          <span className="text-xl font-extrabold tracking-wide">
            FAN<span className="text-amber-400">VERSE</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
          <Link href="/" className="hover:text-amber-400">
            Home
          </Link>
          <a href="#polls" className="hover:text-amber-400">
            Explore Polls
          </a>
          <a href="#categories" className="hover:text-amber-400">
            Categories
          </a>
        </div>

        <a
          href="#polls"
          className="hidden rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 sm:block"
        >
          Start Voting
        </a>
      </nav>
    </header>
  );
}
