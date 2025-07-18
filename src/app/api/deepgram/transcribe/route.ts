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

    // Get audio and language from form data
    const formData = await request.formData();
    const audioBlob = formData.get("audio") as Blob;
    const language = (formData.get("language") as string) || "en";
    
    if (!audioBlob) {
      console.error("No audio file provided in form data");
      return NextResponse.json(
        { message: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate audio size and type
    console.log("Audio size:", audioBlob.size);
    if (audioBlob.size > 50 * 1024 * 1024) {
      // Limit to 50MB
      console.error(`Audio file too large: ${audioBlob.size} bytes`);
      return NextResponse.json(
        { message: "Audio file too large (max 50MB)" },
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

    // Convert Blob to Buffer (minimize memory usage)
    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
    console.log("Buffer created, size:", audioBuffer.length);

    // Initialize Deepgram client
    const deepgram = createClient(deepgramApiKey);

    // Transcribe audio with language support
    const transcribeOptions: any = {
      model: "nova-3",
      smart_format: true,
      punctuate: true,
      utterances: true,
      mimetype: mimeType,
    };

    // Add language parameter for non-English languages
    if (language !== "en") {
      transcribeOptions.language = language;
    }

    console.log("Transcribing with options:", transcribeOptions);
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      transcribeOptions
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
