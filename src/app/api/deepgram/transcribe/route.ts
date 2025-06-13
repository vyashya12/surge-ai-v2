import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

interface TranscribeResponse {
  text: string;
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
    // if (audioBlob.size < 512) {
    //   console.error(`Audio blob too small: ${audioBlob.size} bytes`);
    //   return NextResponse.json(
    //     { message: "Audio file too small" },
    //     { status: 400 }
    //   );
    // }

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

    // Convert Blob to Buffer
    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());

    // Initialize Deepgram client
    const deepgram = createClient(deepgramApiKey);

    // Transcribe audio without diarization
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "whisper-large",
        smart_format: true,
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

    // Extract transcription text
    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ||
      "";
    if (!transcript) {
      console.warn("No transcription available");
      return NextResponse.json(
        { message: "No transcription available", text: "" },
        { status: 200 }
      );
    }

    return NextResponse.json({ text: transcript }, { status: 200 });
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
