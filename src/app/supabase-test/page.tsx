
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_enabled: boolean;
};

export default function SupabaseTestPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCategories = async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, icon, is_enabled")
        .order("name");

      if (error) throw error;

      setCategories(data ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to Supabase."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <main className="min-h-screen bg-[#090910] px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="glass rounded-2xl border border-white/10 p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-orange-500/10 p-3">
              <Database className="text-orange-400" size={26} />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                Supabase Connection Test
              </h1>
              <p className="text-sm text-gray-400">
                FanVerse backend verification
              </p>
            </div>
          </div>

          {loading && (
            <p className="text-gray-400">
              Connecting to Supabase...
            </p>
          )}

          {!loading && !error && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 size={20} />
                <span className="font-semibold">
                  Supabase connection successful!
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-300">
                Retrieved {categories.length} categories from PostgreSQL.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle size={20} />
                <span className="font-semibold">
                  Connection failed
                </span>
              </div>

              <p className="mt-3 break-words text-sm text-gray-300">
                {error}
              </p>
            </div>
          )}

          {!loading && categories.length > 0 && (
            <div className="mt-7">
              <h2 className="mb-4 text-lg font-bold">
                Database Categories
              </h2>

              <div className="space-y-3">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div>
                      <p className="font-semibold">
                        {category.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {category.slug}
                      </p>
                    </div>

                    <span className="text-xs text-green-400">
                      {category.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={fetchCategories}
            disabled={loading}
            className="mt-7 flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            Test Connection Again
          </button>
        </div>
      </div>
    </main>
  );
}
