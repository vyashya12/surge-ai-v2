// app/api/label_conversation/route.ts

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

interface Segment {
  text: string;
  speaker: string;
}

interface LabelConversationRequest {
  data: Segment[];
}

interface LabelConversationResponse {
  data: Segment[];
}

// Simple merge of same‐speaker runs
const mergeSegments = (segments: Segment[]): Segment[] => {
  if (segments.length === 0) return [];
  const merged: Segment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    if (next.speaker === current.speaker) {
      current.text += next.text.startsWith(",") ? next.text : ` ${next.text}`;
    } else {
      merged.push({ ...current });
      current = { ...next };
    }
  }
  merged.push({ ...current });
  return merged.map((seg) => ({ text: seg.text.trim(), speaker: seg.speaker }));
};

// Heuristic to flip mis-labeled speakers
const correctSpeakerLabels = (segments: Segment[]): Segment[] => {
  return segments.map((segment, idx) => {
    const txt = segment.text.toLowerCase();
    let speaker = segment.speaker;

    if (
      txt.includes("?") ||
      txt.includes("let's") ||
      txt.includes("recommend") ||
      txt.includes("x-ray")
    ) {
      speaker = "doctor";
    } else if (
      txt.includes("i have") ||
      txt.includes("pain") ||
      txt.includes("yeah")
    ) {
      speaker = "patient";
    }

    // alternate if two in a row of same
    if (
      idx > 0 &&
      segments[idx - 1].speaker === speaker &&
      !txt.startsWith("and") &&
      !txt.startsWith(",")
    ) {
      speaker = speaker === "doctor" ? "patient" : "doctor";
    }

    return { text: segment.text, speaker };
  });
};

export async function POST(request: NextRequest) {
  // 1) Ensure backend URL is configured
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
  if (!backendUrl) {
    console.error("Missing NEXT_PUBLIC_BACKEND_API_URL");
    return NextResponse.json(
      { message: "Backend URL not configured" },
      { status: 500 }
    );
  }

  // 2) Auth check
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.error("Missing or invalid Authorization header");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // 3) Parse incoming body
  let body: LabelConversationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.data) || body.data.length === 0) {
    return NextResponse.json(
      { message: "Invalid request: data must be a non-empty array" },
      { status: 400 }
    );
  }

  try {
    // 4) Forward to your v2 endpoint
    const resp = await axios.post<LabelConversationResponse>(
      `${backendUrl}/label-conversation2`,
      { data: body.data },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      }
    );

    if (!Array.isArray(resp.data.data)) {
      console.error("Bad response shape from backend:", resp.data);
      return NextResponse.json(
        { message: "Invalid backend response" },
        { status: 502 }
      );
    }

    // 5) Correct & merge
    const corrected = correctSpeakerLabels(resp.data.data);
    const merged = mergeSegments(corrected);

    // 6) Return cleaned segments
    return NextResponse.json({ data: merged }, { status: 200 });
  } catch (err: any) {
    // Axios errors
    if (axios.isAxiosError(err) && err.response) {
      console.error(
        `Backend API error: HTTP ${err.response.status}`,
        err.response.data
      );
      return NextResponse.json(
        {
          message: `Backend error: ${
            err.response.data?.message || err.message
          }`,
        },
        { status: err.response.status }
      );
    }
    console.error("Unexpected error in label_conversation:", err);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
