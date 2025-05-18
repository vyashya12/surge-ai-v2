import { NextResponse } from "next/server";
import { createClient, DeepgramClient, DeepgramError } from "@deepgram/sdk";

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

    // Convert Blob to Buffer
    const buffer = Buffer.from(await audioBlob.arrayBuffer());

    // Send to Deepgram for transcription
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: "whisper-large",
        smart_format: true,
        diarize: true,
        num_speakers: 2, // Explicitly expect two speakers
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

    // Extract transcript and words
    const alternatives = result.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alternatives?.transcript || "";
    const words = alternatives?.words || [];

    if (!words.length) {
      console.error("No words returned from Deepgram");
      return NextResponse.json(
        { message: "No transcription data returned" },
        { status: 400 }
      );
    }

    // Log speaker assignments for debugging
    console.log(
      "Deepgram speaker assignments:",
      words.map((w) => ({
        word: w.punctuated_word,
        speaker: w.speaker,
        speaker_confidence: w.speaker_confidence,
      }))
    );

    // Normalize speaker labels with stricter matching
    const doctorKeywords = [
      "prescribe",
      "diagnose",
      "treatment",
      "examination",
      "referral",
      "recommend",
      "describe",
      "detail", // Added for context like "in more detail"
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

    // Group words into segments by speaker and sentence boundaries
    const segments: { text: string; speaker: string }[] = [];
    let currentSegment: { text: string; speaker: number | null } = {
      text: "",
      speaker: null,
    };
    let lastSpeaker: string | null = null;
    let lastEndTime = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const speaker = word.speaker ?? 0;
      const punctuated = word.punctuated_word || word.word;

      // Detect speaker change based on Deepgram or time gap (>1s)
      const isSpeakerChange =
        currentSegment.speaker !== null &&
        (speaker !== currentSegment.speaker ||
          (word.start - lastEndTime > 1 && i > 0));

      // End segment on punctuation or speaker change
      const isSentenceEnd =
        punctuated.endsWith(".") || punctuated.endsWith("?");

      if (currentSegment.speaker === null) {
        currentSegment.speaker = speaker;
        currentSegment.text = punctuated;
      } else if (!isSpeakerChange && !isSentenceEnd) {
        currentSegment.text += ` ${punctuated}`;
      } else {
        const normalizedSpeaker = normalizeSpeaker(
          currentSegment.text,
          lastSpeaker
        );
        segments.push({
          text: currentSegment.text.trim(),
          speaker: normalizedSpeaker,
        });
        lastSpeaker = normalizedSpeaker;
        currentSegment = { text: punctuated, speaker };
      }

      lastEndTime = word.end;
    }

    // Push the last segment
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

    // Log final segments for debugging
    console.log("Final segments:", segments);

    return NextResponse.json({ data: segments }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("Deepgram transcription error:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
