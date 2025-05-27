// app/src/app/api/save-audio/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File;
    const sessionId = formData.get("sessionId") as string;
    if (!audio) {
      return NextResponse.json(
        { message: "No audio file provided" },
        { status: 400 }
      );
    }
    const audioDir = path.join(process.cwd(), "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    const filename = audio.name;
    const filePath = path.join(audioDir, filename);
    const buffer = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return NextResponse.json({ filename });
  } catch (error) {
    console.error("Save audio error:", error);
    return NextResponse.json(
      { message: "Failed to save audio" },
      { status: 500 }
    );
  }
}
