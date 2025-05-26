import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ensureDir } from "fs-extra";

export async function POST(request: Request) {
  try {
    const audioDir = path.join(process.cwd(), "audio");
    await ensureDir(audioDir);

    const body = await request.json();
    const { sessionId, audio } = body;
    if (!sessionId || !audio || !audio.data || !audio.type) {
      return NextResponse.json(
        { message: "Missing sessionId, audio data, or MIME type" },
        { status: 400 }
      );
    }

    const extension = audio.type.includes("webm") ? "webm" : "wav";
    const filename = `session-${sessionId}.${extension}`;
    const filePath = path.join(audioDir, filename);
    const buffer = Buffer.from(audio.data, "base64");
    await fs.writeFile(filePath, buffer);

    console.log(`Saved audio to ${filePath}`);
    return NextResponse.json({ filename }, { status: 200 });
  } catch (error) {
    console.error("Save audio error:", error);
    return NextResponse.json(
      { message: "Failed to save audio" },
      { status: 500 }
    );
  }
}
