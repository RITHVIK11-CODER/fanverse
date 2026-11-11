
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  name: string;
};

type OptionForm = {
  id?: string;
  option_text: string;
  image_url: string;
  file: File | null;
  preview: string;
};

type PollForm = {
  title: string;
  description: string;
  category_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  results_visible: boolean;
  cover_image: string;
  cover_file: File | null;
};

const EMPTY_OPTION: OptionForm = {
  option_text: "",
  image_url: "",
  file: null,
  preview: "",
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

export default function EditPollPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pollId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [originalOptionIds, setOriginalOptionIds] = useState<string[]>([]);

  const [form, setForm] = useState<PollForm>({
    title: "",
    description: "",
    category_id: "",
    status: "draft",
    starts_at: "",
    ends_at: "",
    results_visible: true,
    cover_image: "",
    cover_file: null,
  });

  const [options, setOptions] = useState<OptionForm[]>([]);

  // ----------------------------------------
  // Load poll data
  // ----------------------------------------

  const loadPoll = useCallback(async () => {
    const supabase = createClient();

    setLoading(true);
    setError("");

    try {
      const [pollResponse, categoryResponse, optionResponse] =
        await Promise.all([
          supabase
            .from("polls")
            .select("*")
            .eq("id", pollId)
            .single(),

          supabase
            .from("categories")
            .select("id, name")
            .order("name"),

          supabase
            .from("poll_options")
            .select("*")
            .eq("poll_id", pollId)
            .order("display_order"),
        ]);

      if (pollResponse.error) throw pollResponse.error;
      if (categoryResponse.error) throw categoryResponse.error;
      if (optionResponse.error) throw optionResponse.error;

      const poll = pollResponse.data;

      setCategories(categoryResponse.data || []);

      setForm({
        title: poll.title || "",
        description: poll.description || "",
        category_id: poll.category_id || "",
        status: poll.status || "draft",
        starts_at: toLocalDateTime(poll.starts_at),
        ends_at: toLocalDateTime(poll.ends_at),
        results_visible: poll.results_visible ?? true,
        cover_image: poll.cover_image || "",
        cover_file: null,
      });

      const loadedOptions: OptionForm[] = (
        optionResponse.data || []
      ).map((option) => ({
        id: option.id,
        option_text: option.option_text || "",
        image_url: option.image_url || "",
        file: null,
        preview: option.image_url || "",
      }));

      setOptions(loadedOptions);
      setOriginalOptionIds(loadedOptions.map((option) => option.id!));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load poll."
      );
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    void loadPoll();
  }, [loadPoll]);

  // ----------------------------------------
  // Form handlers
  // ----------------------------------------

  const updateField = <K extends keyof PollForm>(
    field: K,
    value: PollForm[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const updateOption = (
    index: number,
    field: keyof OptionForm,
    value: string | File | null
  ) => {
    setOptions((previous) =>
      previous.map((option, optionIndex) =>
        optionIndex === index
          ? { ...option, [field]: value }
          : option
      )
    );
  };

  const addOption = () => {
    setOptions((previous) => [...previous, { ...EMPTY_OPTION }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      setError("A poll must have at least two options.");
      return;
    }

    setOptions((previous) =>
      previous.filter((_, optionIndex) => optionIndex !== index)
    );
  };

  // ----------------------------------------
  // Image upload
  // ----------------------------------------

  const uploadImage = async (
    file: File,
    folder: string
  ): Promise<string> => {
    const supabase = createClient();

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("poll-images")
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("poll-images")
      .getPublicUrl(path);

    return data.publicUrl;
  };

  // ----------------------------------------
  // Save poll
  // ----------------------------------------

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("Enter a poll title.");
      return;
    }

    if (!form.category_id) {
      setError("Select a category.");
      return;
    }

    if (options.length < 2) {
      setError("A poll must have at least two options.");
      return;
    }

    if (options.some((option) => !option.option_text.trim())) {
      setError("Every option must have a name.");
      return;
    }

    if (form.starts_at && form.ends_at) {
      if (
        new Date(form.ends_at).getTime() <=
        new Date(form.starts_at).getTime()
      ) {
        setError("End date must be later than start date.");
        return;
      }
    }

    const supabase = createClient();

    setSaving(true);

    try {
      // First, protect existing vote history.
      const currentOptionIds = options
        .filter((option) => option.id)
        .map((option) => option.id!);

      const removedOptionIds = originalOptionIds.filter(
        (id) => !currentOptionIds.includes(id)
      );

      for (const optionId of removedOptionIds) {
        const { count, error: countError } = await supabase
          .from("votes")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("poll_id", pollId)
          .eq("option_id", optionId);

        if (countError) throw countError;

        if ((count || 0) > 0) {
          throw new Error(
            "An option you removed already has votes. It cannot be deleted because that would remove voting history. Restore that option and save again."
          );
        }
      }

      // Upload cover image if changed.
      let coverImage = form.cover_image;

      if (form.cover_file) {
        coverImage = await uploadImage(
          form.cover_file,
          `covers/${pollId}`
        );
      }

      // Update main poll.
      const { error: pollError } = await supabase
        .from("polls")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          category_id: form.category_id,
          status: form.status,
          starts_at: form.starts_at
            ? new Date(form.starts_at).toISOString()
            : null,
          ends_at: form.ends_at
            ? new Date(form.ends_at).toISOString()
            : null,
          results_visible: form.results_visible,
          cover_image: coverImage || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pollId);

      if (pollError) throw pollError;

      // Update existing options and insert new options.
      for (let index = 0; index < options.length; index++) {
        const option = options[index];

        let imageUrl = option.image_url;

        if (option.file) {
          imageUrl = await uploadImage(
            option.file,
            `options/${pollId}`
          );
        }

        if (option.id) {
          const { error: optionError } = await supabase
            .from("poll_options")
            .update({
              option_text: option.option_text.trim(),
              image_url: imageUrl || null,
              display_order: index,
            })
            .eq("id", option.id)
            .eq("poll_id", pollId);

          if (optionError) throw optionError;
        } else {
          const { error: insertError } = await supabase
            .from("poll_options")
            .insert({
              poll_id: pollId,
              option_text: option.option_text.trim(),
              image_url: imageUrl || null,
              display_order: index,
            });

          if (insertError) throw insertError;
        }
      }

      // Delete removed options only after verifying they have no votes.
      if (removedOptionIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("poll_options")
          .delete()
          .eq("poll_id", pollId)
          .in("id", removedOptionIds);

        if (deleteError) throw deleteError;
      }

      setSuccess("Poll updated successfully!");

      await loadPoll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update poll."
      );
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------
  // Loading screen
  // ----------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white">
        <Loader2 className="animate-spin" size={28} />
        <span className="ml-3 text-white/60">Loading poll...</span>
      </div>
    );
  }

  // ----------------------------------------
  // Page UI
  // ----------------------------------------

  return (
    <div className="mx-auto max-w-5xl space-y-7 p-4 text-white sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/polls"
            className="mb-4 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Poll Management
          </Link>

          <h1 className="text-2xl font-bold sm:text-3xl">
            Edit Poll
          </h1>

          <p className="mt-2 text-sm text-white/45">
            Update poll details, images and voting options.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-7">
        {/* Basic details */}

        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Poll Information</h2>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              Poll Title *
            </label>

            <input
              value={form.title}
              onChange={(event) =>
                updateField("title", event.target.value)
              }
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-orange-400"
              placeholder="Enter poll title"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              Description
            </label>

            <textarea
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              rows={4}
              className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-orange-400"
              placeholder="Describe your poll..."
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/60">
                Category *
              </label>

              <select
                value={form.category_id}
                onChange={(event) =>
                  updateField("category_id", event.target.value)
                }
                required
                className="w-full rounded-xl border border-white/10 bg-[#171722] px-4 py-3 outline-none focus:border-orange-400"
              >
                <option value="">Select category</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/60">
                Poll Status
              </label>

              <select
                value={form.status}
                onChange={(event) =>
                  updateField("status", event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-[#171722] px-4 py-3 outline-none focus:border-orange-400"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
              </select>
            </div>
          </div>
        </section>

        {/* Cover image */}

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Poll Cover Image</h2>

          {form.cover_image && !form.cover_file && (
            <img
              src={form.cover_image}
              alt="Poll cover"
              className="h-48 w-full rounded-xl object-cover"
            />
          )}

          {form.cover_file && (
            <img
              src={URL.createObjectURL(form.cover_file)}
              alt="New poll cover preview"
              className="h-48 w-full rounded-xl object-cover"
            />
          )}

          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 bg-black/20 p-6 text-sm text-white/60 transition hover:border-orange-400">
            <ImagePlus size={20} />
            Choose new cover image

            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) =>
                updateField(
                  "cover_file",
                  event.target.files?.[0] || null
                )
              }
            />
          </label>
        </section>

        {/* Schedule */}

        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Schedule & Results</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/60">
                Start Date & Time
              </label>

              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(event) =>
                  updateField("starts_at", event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/60">
                End Date & Time
              </label>

              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(event) =>
                  updateField("ends_at", event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-orange-400"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={form.results_visible}
              onChange={(event) =>
                updateField("results_visible", event.target.checked)
              }
              className="h-4 w-4 accent-orange-500"
            />
            Make poll results visible to the public
          </label>
        </section>

        {/* Options */}

        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Poll Options</h2>
              <p className="mt-1 text-sm text-white/45">
                Edit, add or remove voting options.
              </p>
            </div>

            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
            >
              <Plus size={17} />
              Add Option
            </button>
          </div>

          <div className="space-y-4">
            {options.map((option, index) => (
              <div
                key={option.id || `new-option-${index}`}
                className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/70">
                    Option {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 transition hover:bg-red-500/10"
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>

                <input
                  value={option.option_text}
                  onChange={(event) =>
                    updateOption(
                      index,
                      "option_text",
                      event.target.value
                    )
                  }
                  required
                  placeholder="Option name"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-orange-400"
                />

                {option.preview && !option.file && (
                  <img
                    src={option.preview}
                    alt={option.option_text}
                    className="h-36 w-full rounded-xl object-cover sm:w-64"
                  />
                )}

                {option.file && (
                  <img
                    src={URL.createObjectURL(option.file)}
                    alt="New option preview"
                    className="h-36 w-full rounded-xl object-cover sm:w-64"
                  />
                )}

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:bg-white/5">
                  <ImagePlus size={16} />
                  Change option image

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;

                      updateOption(index, "file", file);

                      if (file) {
                        updateOption(
                          index,
                          "preview",
                          URL.createObjectURL(file)
                        );
                      }
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Save */}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/polls")}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/70 transition hover:bg-white/5"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-3 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
