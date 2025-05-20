import { NextResponse } from "next/server";
import { createClient, DeepgramClient, DeepgramError } from "@deepgram/sdk";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error("Deepgram API key not configured");
      return NextResponse.json(
        { message: "Deepgram API key not configured" },
        { status: 500 }
      );
    }

    const deepgram: DeepgramClient = createClient(apiKey);
    const formData = await request.formData();
    const audioBlob = formData.get("audio") as Blob;

    if (!audioBlob || audioBlob.size < 2000) {
      console.error(`Invalid audio file: size=${audioBlob?.size || 0} bytes`);
      return NextResponse.json(
        { message: "Invalid audio file: empty or too small" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await audioBlob.arrayBuffer());
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: "whisper-large",
        smart_format: true,
        diarize: true,
        num_speakers: 2,
        language: "en",
        mimetype: audioBlob.type || "audio/ogg",
      }
    );

    if (error) {
      console.error("Deepgram transcription error:", error);
      return NextResponse.json(
        { message: (error as DeepgramError).message || "Transcription failed" },
        { status: 500 }
      );
    }

    const alternatives = result.results?.channels?.[0]?.alternatives?.[0];
    const words = alternatives?.words || [];

    if (!words.length) {
      console.error("No words returned from Deepgram");
      return NextResponse.json(
        { message: "No transcription data returned" },
        { status: 400 }
      );
    }

    // Improved speaker normalization
    const doctorKeywords = [
      "prescribe",
      "diagnose",
      "treatment",
      "examination",
      "referral",
      "recommend",
      "describe",
      "detail",
    ];

    const normalizeSpeaker = (
      text: string,
      prevSpeaker: string | null
    ): string => {
      const textLower = text.toLowerCase();
      const hasDoctorKeyword = doctorKeywords.some((keyword) =>
        textLower.includes(keyword)
      );
      return hasDoctorKeyword
        ? "doctor"
        : prevSpeaker === "doctor"
        ? "patient"
        : "patient";
    };

    // Improved segmentation logic
    const segments: { text: string; speaker: string }[] = [];
    let currentSegment: { text: string; speaker: number | null } = {
      text: "",
      speaker: null,
    };
    let lastSpeaker: string | null = null;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const speaker = word.speaker ?? 0;
      const punctuated = word.punctuated_word || word.word;

      // Initialize segment if empty
      if (currentSegment.speaker === null) {
        currentSegment.speaker = speaker;
        currentSegment.text = punctuated;
        continue;
      }

      // Check for speaker change or sentence end
      const isSpeakerChange = speaker !== currentSegment.speaker;
      const isSentenceEnd = punctuated.match(/[.!?]/) !== null;

      // If same speaker and not sentence end, continue building segment
      if (!isSpeakerChange && !isSentenceEnd) {
        currentSegment.text += ` ${punctuated}`;
      } else {
        // Finalize current segment
        const normalizedSpeaker = normalizeSpeaker(
          currentSegment.text,
          lastSpeaker
        );
        segments.push({
          text: currentSegment.text.trim(),
          speaker: normalizedSpeaker,
        });
        lastSpeaker = normalizedSpeaker;

        // Start new segment
        currentSegment = {
          text: punctuated,
          speaker: isSpeakerChange ? speaker : currentSegment.speaker,
        };
      }
    }

    // Push the last segment if it exists
    if (currentSegment.text) {
      const normalizedSpeaker = normalizeSpeaker(
        currentSegment.text,
        lastSpeaker
      );
      segments.push({
        text: currentSegment.text.trim(),
        speaker: normalizedSpeaker,
      });
    }

    // Post-process to merge incomplete sentences
    const mergedSegments: { text: string; speaker: string }[] = [];
    for (let i = 0; i < segments.length; i++) {
      const current = segments[i];
      const next = segments[i + 1];

      // Check if current segment ends with a question mark or period
      const isComplete =
        current.text.endsWith(".") ||
        current.text.endsWith("?") ||
        current.text.endsWith("!");

      if (!isComplete && next && current.speaker === next.speaker) {
        // Merge with next segment
        mergedSegments.push({
          text: `${current.text} ${next.text}`,
          speaker: current.speaker,
        });
        i++; // Skip next segment since we merged it
      } else {
        mergedSegments.push(current);
      }
    }

    return NextResponse.json({ data: mergedSegments }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("Deepgram transcription error:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
