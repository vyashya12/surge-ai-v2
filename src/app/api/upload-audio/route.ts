import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    // Validate token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    // TODO: Add token verification (e.g., JWT decoding) if required

    // Get form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob;
    const sessionId = formData.get("session_id") as string;

    if (!audioFile || !sessionId) {
      console.error("Missing audio file or session ID");
      return NextResponse.json(
        { message: "Missing audio file or session ID" },
        { status: 400 }
      );
    }

    if (audioFile.size < 512) {
      console.error(`Invalid audio file: size=${audioFile.size} bytes`);
      return NextResponse.json(
        { message: "Invalid audio file: too small" },
        { status: 400 }
      );
    }

    // Convert Blob to Buffer
    const buffer = Buffer.from(await audioFile.arrayBuffer());

    // Generate unique file key
    const fileKey = `sessions/${sessionId}-${uuidv4()}.webm`;

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET || "surge-ai-audio-uploads",
      Key: fileKey,
      Body: buffer,
      ContentType: audioFile.type || "audio/webm",
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    // Construct S3 URL
    const audioUrl = `https://${uploadParams.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

    console.log(`Successfully uploaded audio to S3: ${audioUrl}`);

    return NextResponse.json(
      { message: "File uploaded successfully", audio_url: audioUrl },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upload audio to S3";
    console.error("Upload error:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
