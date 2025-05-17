import { NextResponse } from "next/server";
import axios from "axios";

const mergeSegments = (
  segments: { text: string; speaker: string }[]
): { text: string; speaker: string }[] => {
  if (!segments.length) return [];
  const merged: { text: string; speaker: string }[] = [];
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

  return merged.map((segment) => ({
    text: segment.text.trim(),
    speaker: segment.speaker,
  }));
};

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      console.error("Backend URL not configured");
      return NextResponse.json(
        { message: "Backend URL not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log("Received body:", JSON.stringify(body, null, 2));

    if (!body.data || !Array.isArray(body.data)) {
      console.error("Invalid request body: data is missing or not an array");
      return NextResponse.json(
        { message: "Invalid request body: data is missing or not an array" },
        { status: 400 }
      );
    }

    console.log("Forwarding to labeling API:", JSON.stringify(body, null, 2));
    const response = await axios.post(
      `${backendUrl}/label-conversation`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Raw backend response:",
      JSON.stringify(response.data, null, 2)
    );

    // Merge segments with the same speaker
    const mergedData = {
      data: mergeSegments(response.data.data || []),
    };

    console.log(
      "Labeling API response (merged):",
      JSON.stringify(mergedData, null, 2)
    );
    return NextResponse.json(mergedData, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        `Labeling API error: HTTP ${error.response.status} - ${
          error.response.data?.message || error.message
        }`
      );
      return NextResponse.json(
        {
          message:
            error.response.data?.message || "Failed to label conversation",
          status: error.response.status,
        },
        { status: error.response.status }
      );
    }
    console.error("Labeling API error:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
