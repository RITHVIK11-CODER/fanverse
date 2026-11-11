
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ImagePlus,
  CalendarDays,
  Save,
  Loader2,
  X,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
};

type PollOption = {
  id: string;
  name: string;
  image: File | null;
  preview: string;
};

export default function CreatePollPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("draft");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [options, setOptions] = useState<PollOption[]>([
    { id: crypto.randomUUID(), name: "", image: null, preview: "" },
    { id: crypto.randomUUID(), name: "", image: null, preview: "" },
  ]);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");

  useEffect(() => {
    async function loadCategories() {
      setLoadingCategories(true);

      const supabase = createClient();

      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_enabled", true)
        .order("name");

      if (error) {
        setMessage(error.message);
        setMessageType("error");
      } else {
        setCategories(data ?? []);

        if (data?.length) {
          setCategoryId(data[0].id);
        }
      }

      setLoadingCategories(false);
    }

    loadCategories();
  }, []);

  const addOption = () => {
    setOptions((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: "",
        image: null,
        preview: "",
      },
    ]);
  };

  const removeOption = (id: string) => {
    if (options.length <= 2) {
      setMessage("A poll must contain at least two options.");
      setMessageType("error");
      return;
    }

    setOptions((previous) =>
      previous.filter((option) => option.id !== id)
    );
    setMessage("");
  };

  const updateOptionName = (id: string, value: string) => {
    setOptions((previous) =>
      previous.map((option) =>
        option.id === id ? { ...option, name: value } : option
      )
    );
  };

  const updateOptionImage = (id: string, file: File | null) => {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Only JPG, PNG and WebP images are supported.");
      setMessageType("error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Each image must be smaller than 5 MB.");
      setMessageType("error");
      return;
    }

    const preview = URL.createObjectURL(file);

    setOptions((previous) =>
      previous.map((option) => {
        if (option.id !== id) return option;

        if (option.preview) URL.revokeObjectURL(option.preview);

        return { ...option, image: file, preview };
      })
    );

    setMessage("");
  };

  const createSlug = (value: string) => {
    const base = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return `${base}-${crypto.randomUUID().slice(0, 8)}`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!title.trim()) {
      setMessage("Please enter a poll title.");
      setMessageType("error");
      return;
    }

    if (!categoryId) {
      setMessage("Please select a category.");
      setMessageType("error");
      return;
    }

    if (options.some((option) => !option.name.trim())) {
      setMessage("Please enter a name for every option.");
      setMessageType("error");
      return;
    }

    if (new Set(options.map((o) => o.name.trim().toLowerCase())).size !== options.length) {
      setMessage("Duplicate poll options are not allowed.");
      setMessageType("error");
      return;
    }

    if (status === "scheduled" && !startDate) {
      setMessage("Please select a start date for a scheduled poll.");
      setMessageType("error");
      return;
    }

    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      setMessage("End date must be later than start date.");
      setMessageType("error");
      return;
    }

    if (endDate && new Date(endDate) <= new Date()) {
      setMessage("End date must be in the future.");
      setMessageType("error");
      return;
    }

    if (status === "active" && startDate && new Date(startDate) > new Date()) {
      setMessage("A poll with a future start date must use Scheduled status.");
      setMessageType("error");
      return;
    }

    setSaving(true);

    const supabase = createClient();
    let createdPollId: string | null = null;
    const uploadedPaths: string[] = [];

    try {
      const slug = createSlug(title);

      // Create the poll record.
      const { data: poll, error: pollError } = await supabase
        .from("polls")
        .insert({
          title: title.trim(),
          slug,
          description: description.trim() || null,
          category_id: categoryId,
          status,
          starts_at: startDate
            ? new Date(startDate).toISOString()
            : null,
          ends_at: endDate
            ? new Date(endDate).toISOString()
            : null,
        })
        .select("id")
        .single();

      if (pollError) throw pollError;

      createdPollId = poll.id;

      // Upload option images.
      const optionRecords = [];

      for (let index = 0; index < options.length; index++) {
        const option = options[index];
        let imageUrl: string | null = null;

        if (option.image) {
          const extension = option.image.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${poll.id}/${crypto.randomUUID()}.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from("poll-images")
            .upload(path, option.image, {
              contentType: option.image.type,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          uploadedPaths.push(path);

          const { data } = supabase.storage
            .from("poll-images")
            .getPublicUrl(path);

          imageUrl = data.publicUrl;
        }

        optionRecords.push({
          poll_id: poll.id,
          option_text: option.name.trim(),
          image_url: imageUrl,
          display_order: index,
        });
      }

      // Save all options.
      const { error: optionsError } = await supabase
        .from("poll_options")
        .insert(optionRecords);

      if (optionsError) throw optionsError;

      setMessageType("success");
      setMessage("Poll created successfully!");

      router.push("/admin/polls");
      router.refresh();
    } catch (error) {
      // Remove partially created data if an operation fails.
      if (createdPollId) {
        await supabase
          .from("polls")
          .delete()
          .eq("id", createdPollId);
      }

      if (uploadedPaths.length) {
        await supabase.storage
          .from("poll-images")
          .remove(uploadedPaths);
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create poll."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090910] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-4xl">

        <button
          type="button"
          onClick={() => router.push("/admin/polls")}
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft size={17} />
          Back to Poll Management
        </button>

        <header className="mb-8">
          <p className="text-sm font-semibold tracking-widest text-orange-400">
            POLL MANAGEMENT
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Create New Poll
          </h1>
          <p className="mt-2 text-gray-400">
            Create a poll and publish it to the FanVerse community.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-7">

          {/* BASIC INFORMATION */}

          <section className="glass rounded-2xl border border-white/10 p-6 md:p-8">
            <h2 className="mb-6 text-xl font-bold">
              Basic Information
            </h2>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Poll Title *
                </label>
                <input
                  required
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Who is the biggest Telugu superstar?"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Description
                </label>
                <textarea
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe this poll..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-orange-400"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Category *
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={loadingCategories || categories.length === 0}
                    className="w-full rounded-xl border border-white/10 bg-[#151520] px-4 py-3 outline-none"
                  >
                    <option value="">
                      {loadingCategories
                        ? "Loading categories..."
                        : "Select category"}
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>

                  {!loadingCategories && categories.length === 0 && (
                    <p className="mt-2 text-xs text-yellow-400">
                      Create an enabled category before creating a poll.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Poll Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#151520] px-4 py-3 outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* POLL OPTIONS */}

          <section className="glass rounded-2xl border border-white/10 p-6 md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Poll Options</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Add actors, movies or other choices.
                </p>
              </div>

              <span className="rounded-lg bg-orange-500/10 px-3 py-2 text-sm text-orange-400">
                {options.length} options
              </span>
            </div>

            <div className="space-y-4">
              {options.map((option, index) => (
                <div
                  key={option.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-300">
                      Option {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeOption(option.id)}
                      className="rounded-lg p-2 text-red-400 hover:bg-red-400/10"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <input
                    required
                    maxLength={100}
                    value={option.name}
                    onChange={(e) =>
                      updateOptionName(option.id, e.target.value)
                    }
                    placeholder="Option name"
                    className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-orange-400"
                  />

                  <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-white/20 p-3 hover:border-orange-400/50">
                    <ImagePlus className="text-orange-400" size={22} />

                    <span className="text-sm text-gray-400">
                      {option.image
                        ? option.image.name
                        : "Upload option image (JPG, PNG, WebP)"}
                    </span>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        updateOptionImage(
                          option.id,
                          e.target.files?.[0] ?? null
                        )
                      }
                    />
                  </label>

                  {option.preview && (
                    <div className="relative mt-4 w-32">
                      <img
                        src={option.preview}
                        alt={option.name || "Option preview"}
                        className="h-32 w-32 rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setOptions((previous) =>
                            previous.map((item) => {
                              if (item.id !== option.id) return item;
                              URL.revokeObjectURL(item.preview);
                              return { ...item, image: null, preview: "" };
                            })
                          );
                        }}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addOption}
              className="mt-5 flex items-center gap-2 rounded-xl border border-dashed border-orange-400/40 px-4 py-3 text-sm font-semibold text-orange-400 hover:bg-orange-500/10"
            >
              <Plus size={18} />
              Add Another Option
            </button>
          </section>

          {/* SCHEDULE */}

          <section className="glass rounded-2xl border border-white/10 p-6 md:p-8">
            <div className="mb-6 flex items-center gap-2">
              <CalendarDays className="text-orange-400" />
              <h2 className="text-xl font-bold">Poll Schedule</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#151520] px-3 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="w-full rounded-xl border border-white/10 bg-[#151520] px-3 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500">
              Scheduled polls require a start date. Date enforcement and automatic
              status transitions will be handled by the backend scheduling stage.
            </p>
          </section>

          {/* MESSAGE */}

          {message && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                messageType === "success"
                  ? "border-green-500/20 bg-green-500/10 text-green-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {message}
            </div>
          )}

          {/* ACTIONS */}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin/polls")}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-300 hover:bg-white/5"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                loadingCategories ||
                categories.length === 0
              }
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {saving ? "Saving Poll..." : "Create Poll"}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-xs text-gray-600">
          FanVerse · Powered by Kage Origin
        </p>
      </div>
    </main>
  );
}
