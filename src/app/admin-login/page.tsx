
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LockKeyhole } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) throw error;

      if (data.user?.app_metadata?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("You are not authorised as an admin.");
      }

      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090910] px-5 text-white">
      <form
        onSubmit={handleLogin}
        className="glass w-full max-w-md rounded-3xl border border-white/10 p-8"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10">
            <LockKeyhole className="text-orange-400" size={28} />
          </div>

          <h1 className="text-3xl font-black">
            FAN<span className="text-orange-400">VERSE</span>
          </h1>

          <p className="mt-3 text-sm text-gray-400">
            Secure administrator login
          </p>
        </div>

        <label className="mb-2 block text-sm text-gray-300">
          Email address
        </label>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          className="mb-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-orange-400"
        />

        <label className="mb-2 block text-sm text-gray-300">
          Password
        </label>

        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="mb-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-orange-400"
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-orange-500 py-3 font-bold hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Access Admin Dashboard"}
        </button>

        <p className="mt-6 text-center text-xs text-gray-500">
          FanVerse · Powered by Kage Origin
        </p>
      </form>
    </main>
  );
}
