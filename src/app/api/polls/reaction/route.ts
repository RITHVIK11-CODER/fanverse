
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_REACTIONS = ["❤️", "🔥", "😂", "😍", "👏"];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { pollId, voterToken, reaction } = body;

    if (
      typeof pollId !== "string" ||
      typeof voterToken !== "string" ||
      voterToken.length < 20 ||
      voterToken.length > 200 ||
      typeof reaction !== "string" ||
      !ALLOWED_REACTIONS.includes(reaction)
    ) {
      return NextResponse.json(
        { error: "Invalid reaction request." },
        { status: 400 }
      );
    }

    const voterTokenHash = createHash("sha256")
      .update(voterToken)
      .digest("hex");

    const supabase = await createClient();

    const { data: insertedReaction, error } =
      await supabase.rpc("set_poll_reaction", {
        p_poll_id: pollId,
        p_voter_token_hash: voterTokenHash,
        p_reaction: reaction,
      });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const { data: counts, error: countsError } =
      await supabase.rpc("get_poll_reactions", {
        p_poll_id: pollId,
      });

    if (countsError) {
      return NextResponse.json(
        { error: countsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reaction: insertedReaction,
      counts: counts ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process reaction." },
      { status: 500 }
    );
  }
}
