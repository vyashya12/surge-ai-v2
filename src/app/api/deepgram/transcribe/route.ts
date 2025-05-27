import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

interface Segment {
  text: string;
  speaker: string;
}

interface TranscribeResponse {
  data: Segment[];
}

export async function POST(request: NextRequest) {
  try {
    // Validate Deepgram API key
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      console.error("Deepgram API key not configured");
      return NextResponse.json(
        { message: "Deepgram API key not configured" },
        { status: 500 }
      );
    }

    // Validate authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return NextResponse.json(
        { message: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }

    // Get audio from form data
    const formData = await request.formData();
    const audioBlob = formData.get("audio") as Blob;
    if (!audioBlob) {
      console.error("No audio file provided in form data");
      return NextResponse.json(
        { message: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate audio size and type
    if (audioBlob.size < 512) {
      console.error(`Audio blob too small: ${audioBlob.size} bytes`);
      return NextResponse.json(
        { message: "Audio file too small" },
        { status: 400 }
      );
    }

    const mimeType = audioBlob.type || "audio/webm;codecs=opus";
    const supportedMimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
    ];
    if (!supportedMimeTypes.includes(mimeType)) {
      console.error(`Unsupported MIME type: ${mimeType}`);
      return NextResponse.json(
        { message: `Unsupported audio format: ${mimeType}` },
        { status: 400 }
      );
    }

    // Log audio details
    console.log(
      `Received audio: type=${audioBlob.type}, size=${
        audioBlob.size
      } bytes, filename=${formData.get("audio")?.toString()}`
    );

    // Convert Blob to Buffer
    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());

    // Initialize Deepgram client
    const deepgram = createClient(deepgramApiKey);

    // Transcribe audio
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "nova-2",
        smart_format: true,
        diarize: true,
        punctuate: true,
        utterances: true,
        mimetype: mimeType,
      }
    );

    if (error) {
      console.error("Deepgram transcription error:", error.message);
      return NextResponse.json(
        { message: `Deepgram error: ${error.message}` },
        { status: 400 }
      );
    }

    // Log raw Deepgram response
    console.log("Deepgram response:", JSON.stringify(result, null, 2));

    // Extract transcription
    const alternatives = result?.results?.channels?.[0]?.alternatives || [];
    if (!alternatives.length || !alternatives[0].words?.length) {
      console.warn("No words returned from Deepgram");
      return NextResponse.json(
        { message: "No transcription available", data: [] },
        { status: 200 }
      );
    }

    // Map words to segments with speaker identification
    const segments: Segment[] = [];
    let currentSpeaker: string | null = null;
    let currentText: string[] = [];

    for (const wordInfo of alternatives[0].words) {
      const speaker = `Speaker ${wordInfo.speaker ?? 0}`;
      if (currentSpeaker === null) {
        currentSpeaker = speaker;
      }

      if (speaker !== currentSpeaker && currentText.length) {
        segments.push({
          text: currentText.join(" ").trim(),
          speaker: currentSpeaker,
        });
        currentText = [];
        currentSpeaker = speaker;
      }

      currentText.push(wordInfo.punctuated_word || wordInfo.word);
    }

    if (currentText.length) {
      segments.push({
        text: currentText.join(" ").trim(),
        speaker: currentSpeaker!,
      });
    }

    // Log segments
    console.log("Processed segments:", JSON.stringify(segments, null, 2));

    return NextResponse.json({ data: segments }, { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to transcribe audio";
    console.error("Transcription error:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
