import { NextResponse } from "next/server";
import { createClient, DeepgramClient } from "@deepgram/sdk";

export async function POST(request: Request) {
  try {
    const startTime = Date.now();
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error("Deepgram API key not configured");
      return NextResponse.json(
        { message: "Deepgram API key not configured" },
        { status: 500 }
      );
    }

    // Initialize Deepgram client
    const deepgram: DeepgramClient = createClient(apiKey);

    // Get the audio file from the request
    const formData = await request.formData();
    const audioBlob = formData.get("audio") as Blob;

    if (!audioBlob || audioBlob.size < 2000) {
      console.error(`Invalid audio file: size=${audioBlob?.size || 0} bytes`);
      return NextResponse.json(
        { message: "Invalid audio file: empty or too small" },
        { status: 400 }
      );
    }

    // Log chunk details
    console.log(
      `Received audio chunk, size: ${audioBlob.size} bytes, type: ${audioBlob.type}`
    );

    // Convert Blob to Buffer
    const buffer = Buffer.from(await audioBlob.arrayBuffer());

    // Send to Deepgram for transcription
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: "nova-2-medical",
        smart_format: true,
        diarize: true,
        language: "en",
        mimetype: audioBlob.type || "audio/ogg",
      }
    );

    if (error) {
      console.error("Deepgram transcription error:", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    // Extract transcript and words
    const alternatives = result.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alternatives?.transcript || "";
    const words = alternatives?.words || [];

    // Normalize speaker labels
    const doctorKeywords = [
      "prescribe",
      "diagnose",
      "treatment",
      "examination",
      "referral",
      "how are you",
      "where",
      "does",
      "what seems",
      "let me",
      "check",
      "recommend",
    ];

    const normalizeSpeaker = (text: string): string => {
      const textLower = text.toLowerCase();
      return doctorKeywords.some((keyword) => textLower.includes(keyword))
        ? "doctor"
        : "patient";
    };

    // Group words into segments by speaker and punctuation
    const segments: { text: string; speaker: string }[] = [];
    let currentSegment: { text: string; speaker: number | null } = {
      text: "",
      speaker: null,
    };

    for (const word of words) {
      const speaker = word.speaker ?? 0;
      const punctuated = word.punctuated_word || word.word;
      if (currentSegment.speaker === null) {
        currentSegment.speaker = speaker;
        currentSegment.text = punctuated;
      } else if (
        currentSegment.speaker === speaker &&
        !punctuated.endsWith(".") &&
        !punctuated.endsWith("?")
      ) {
        currentSegment.text += ` ${punctuated}`;
      } else {
        segments.push({
          text: currentSegment.text.trim(),
          speaker: normalizeSpeaker(currentSegment.text),
        });
        currentSegment = { text: punctuated, speaker };
      }
    }

    // Push the last segment
    if (currentSegment.text) {
      segments.push({
        text: currentSegment.text.trim(),
        speaker: normalizeSpeaker(currentSegment.text),
      });
    }

    // Log the raw Deepgram response and segments
    // console.log(
    //   "Raw Deepgram response:",
    //   JSON.stringify({ transcript, words }, null, 2)
    // );
    // console.log("Structured segments:", JSON.stringify(segments, null, 2));

    return NextResponse.json({ data: segments }, { status: 200 });
  } catch (error) {
    console.error("Deepgram transcription error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
