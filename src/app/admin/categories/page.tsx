
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Tags,
  X,
  Film,
  Music,
  Drama,
  Mic2,
  Trophy,
  Gamepad2,
  RefreshCw,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_enabled: boolean;
  pollCount: number;
};

const iconMap: Record<string, typeof Film> = {
  film: Film,
  drama: Drama,
  trophy: Trophy,
  music: Music,
  mic: Mic2,
  game: Gamepad2,
};

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoryManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("film");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const [
        { data: categoryData, error: categoryError },
        { data: pollData, error: pollError },
      ] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, slug, description, icon, is_enabled")
          .order("name"),
        supabase
          .from("polls")
          .select("category_id"),
      ]);

      if (categoryError) throw categoryError;
      if (pollError) throw pollError;

      const counts: Record<string, number> = {};

      (pollData ?? []).forEach((poll) => {
        if (poll.category_id) {
          counts[poll.category_id] =
            (counts[poll.category_id] ?? 0) + 1;
        }
      });

      setCategories(
        (categoryData ?? []).map((category) => ({
          ...category,
          pollCount: counts[category.id] ?? 0,
        }))
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load categories."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIcon("film");
    setEditingId(null);
    setShowForm(false);
    setMessage("");
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setMessage("Please enter a category name.");
      setMessageType("error");
      return;
    }

    const slug = createSlug(name);

    if (!slug) {
      setMessage("Please enter a valid category name.");
      setMessageType("error");
      return;
    }

    const duplicate = categories.some(
      (category) =>
        category.slug === slug && category.id !== editingId
    );

    if (duplicate) {
      setMessage("A category with this name already exists.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const supabase = createClient();

      const values = {
        name: name.trim(),
        slug,
        description: description.trim() || null,
        icon,
      };

      if (editingId) {
        const { error } = await supabase
          .from("categories")
          .update(values)
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert(values);

        if (error) throw error;
      }

      resetForm();
      await fetchCategories();

      setMessageType("success");
      setMessage(
        editingId
          ? "Category updated successfully."
          : "Category created successfully."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save category."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description ?? "");
    setIcon(category.icon ?? "film");
    setShowForm(true);
    setMessage("");
  };

  const toggleCategory = async (category: Category) => {
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("categories")
        .update({ is_enabled: !category.is_enabled })
        .eq("id", category.id);

      if (error) throw error;

      await fetchCategories();
      setMessageType("success");
      setMessage(
        `${category.name} ${
          category.is_enabled ? "disabled" : "enabled"
        } successfully.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update category."
      );
      setMessageType("error");
    }
  };

  const deleteCategory = async (category: Category) => {
    if (category.pollCount > 0) {
      setMessage(
        `Cannot delete ${category.name}. Reassign its ${category.pollCount} poll(s) first.`
      );
      setMessageType("error");
      return;
    }

    if (!window.confirm(`Delete "${category.name}" permanently?`)) {
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id);

      if (error) throw error;

      await fetchCategories();
      setMessageType("success");
      setMessage("Category deleted successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete category."
      );
      setMessageType("error");
    }
  };

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase())
  );

  const enabledCount = categories.filter(
    (category) => category.is_enabled
  ).length;

  return (
    <main className="min-h-screen bg-[#090910] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm tracking-widest text-orange-400">
              ADMIN WORKSPACE
            </p>

            <h1 className="mt-2 text-3xl font-bold md:text-4xl">
              Category Management
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              Manage your Telugu cinema poll categories.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600"
          >
            <Plus size={18} />
            Add Category
          </button>
        </header>

        {/* Statistics */}

        <div className="mb-7 grid gap-4 sm:grid-cols-3">
          {[
            ["Total Categories", categories.length],
            ["Enabled", enabledCount],
            ["Disabled", categories.length - enabledCount],
          ].map(([label, value]) => (
            <div
              key={label}
              className="glass rounded-2xl border border-white/10 p-5"
            >
              <p className="text-sm text-gray-400">{label}</p>
              <p className="mt-3 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Category Form */}

        {showForm && (
          <form
            onSubmit={saveCategory}
            className="glass mb-8 rounded-2xl border border-orange-400/20 p-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingId ? "Edit Category" : "Add New Category"}
              </h2>

              <button type="button" onClick={resetForm}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Category Name *
                </label>

                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Example: Telugu Actors"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Category Icon
                </label>

                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#151520] px-4 py-3"
                >
                  <option value="film">Film</option>
                  <option value="drama">Drama</option>
                  <option value="trophy">Trophy</option>
                  <option value="music">Music</option>
                  <option value="mic">Microphone</option>
                  <option value="game">Game</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-gray-300">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe this category..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-orange-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 rounded-xl bg-orange-500 px-6 py-3 font-semibold hover:bg-orange-600 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Create Category"}
            </button>
          </form>
        )}

        {/* Messages */}

        {message && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm ${
              messageType === "success"
                ? "border-green-500/20 bg-green-500/10 text-green-400"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {message}
          </div>
        )}

        {/* Categories */}

        <section className="glass rounded-2xl border border-white/10 p-5 md:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold">All Categories</h2>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Tags size={17} className="text-gray-500" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="w-40 bg-transparent text-sm outline-none"
              />

              <button
                type="button"
                onClick={fetchCategories}
                title="Refresh categories"
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {loading ? (
            <p className="py-12 text-center text-gray-400">
              Loading categories from Supabase...
            </p>
          ) : filteredCategories.length === 0 ? (
            <p className="py-12 text-center text-gray-500">
              No categories found. Create your first category.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => {
                const Icon = iconMap[category.icon ?? "film"] ?? Film;

                return (
                  <div
                    key={category.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="rounded-xl bg-orange-500/10 p-3">
                        <Icon size={23} className="text-orange-400" />
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          category.is_enabled
                            ? "bg-green-500/10 text-green-400"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {category.is_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold">
                      {category.name}
                    </h3>

                    <p className="mt-2 min-h-10 text-sm text-gray-400">
                      {category.description || "No description provided."}
                    </p>

                    <p className="mt-4 text-xs text-gray-500">
                      {category.pollCount} associated polls
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <button
                        onClick={() => editCategory(category)}
                        className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                      >
                        <Pencil size={15} />
                        Edit
                      </button>

                      <button
                        onClick={() => toggleCategory(category)}
                        className="rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                      >
                        {category.is_enabled ? "Disable" : "Enable"}
                      </button>

                      <button
                        onClick={() => deleteCategory(category)}
                        disabled={category.pollCount > 0}
                        title={
                          category.pollCount > 0
                            ? "Reassign polls before deleting"
                            : "Delete category"
                        }
                        className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-gray-600">
          FanVerse Admin · Powered by Kage Origin
        </p>
      </div>
    </main>
  );
}
