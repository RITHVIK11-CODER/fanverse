
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/navbar";
import PollDetails from "@/components/polls/poll-details";
import { connection } from "next/server";

export const instant = false;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PollPage({ params }: PageProps) {
    await connection();
  const { slug } = await params;
  const supabase = await createClient();

  const { data: poll, error } = await supabase
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
      poll_options (
        id,
        option_text,
        image_url,
        display_order
      )
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !poll) {
    notFound();
  }

  const options = [...(poll.poll_options ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map((option) => ({
      id: option.id,
      option_text: option.option_text,
      image_url: option.image_url,
      display_order: option.display_order,
    }));

  return (
    <>
      <Navbar />

      <PollDetails
        poll={{
          id: poll.id,
          slug: poll.slug,
          title: poll.title,
          description: poll.description,
          status: poll.status,
          cover_image: poll.cover_image,
          starts_at: poll.starts_at,
          ends_at: poll.ends_at,
          results_visible: poll.results_visible,
          options,
        }}
      />
    </>
  );
}
