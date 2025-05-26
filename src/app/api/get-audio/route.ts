import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    if (!filename) {
      return NextResponse.json(
        { message: "Missing filename" },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), "audio", filename);
    const buffer = await fs.readFile(filePath);
    const base64Data = buffer.toString("base64");
    const mimetype = filename.endsWith(".webm")
      ? "audio/webm;codecs=opus"
      : "audio/wav";

    return NextResponse.json({ data: base64Data, mimetype }, { status: 200 });
  } catch (error) {
    console.error("Get audio error:", error);
    return NextResponse.json(
      { message: "Failed to retrieve audio" },
      { status: 500 }
    );
  }
}
