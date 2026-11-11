
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const pollId = body.pollId;
    const optionId = body.optionId;
    const voterToken = body.voterToken;

    if (
      typeof pollId !== "string" ||
      typeof optionId !== "string" ||
      typeof voterToken !== "string" ||
      voterToken.length < 20 ||
      voterToken.length > 200
    ) {
      return NextResponse.json(
        { error: "Invalid vote request." },
        { status: 400 }
      );
    }

    const voterTokenHash = createHash("sha256")
      .update(voterToken)
      .digest("hex");

    const supabase = await createClient();

    const { data: inserted, error } = await supabase.rpc(
      "submit_poll_vote",
      {
        p_poll_id: pollId,
        p_option_id: optionId,
        p_voter_token_hash: voterTokenHash,
      }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const { data: results, error: resultsError } =
      await supabase.rpc("get_poll_results", {
        p_poll_id: pollId,
      });

    if (resultsError) {
      return NextResponse.json(
        { error: resultsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inserted,
      message: inserted
        ? "Your vote has been recorded."
        : "You have already voted for this option.",
      results: results ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process your vote." },
      { status: 500 }
    );
  }
}
