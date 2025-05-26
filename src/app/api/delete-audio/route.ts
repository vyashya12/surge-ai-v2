import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename } = body;
    if (!filename) {
      return NextResponse.json(
        { message: "Missing filename" },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), "audio", filename);
    await fs.unlink(filePath);
    console.log(`Deleted audio file: ${filePath}`);

    return NextResponse.json({ message: "File deleted" }, { status: 200 });
  } catch (error) {
    console.error("Delete audio error:", error);
    return NextResponse.json(
      { message: "Failed to delete audio" },
      { status: 500 }
    );
  }
}
