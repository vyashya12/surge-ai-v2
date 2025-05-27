import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: "ap-southeast-5",
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function GET(request: Request) {
  try {
    // Validate environment variables
    if (
      !process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID ||
      !process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
    ) {
      console.error("AWS credentials not configured");
      return NextResponse.json(
        { message: "AWS credentials not configured" },
        { status: 500 }
      );
    }

    // Extract token from headers (optional, for authentication)
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      console.warn("No authorization token provided");
      // Optionally, return 401 if authentication is required
      // return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Generate unique key for the audio file
    const key = `audio/${Date.now()}.webm`;

    // Create PutObject command for S3
    const command = new PutObjectCommand({
      Bucket: "surge-ai-audio-uploads",
      Key: key,
      ContentType: "audio/webm",
    });

    // Generate pre-signed URL (expires in 1 hour)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Return pre-signed URL and key
    return NextResponse.json({ url, key }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to generate pre-signed URL";
    console.error("S3 pre-signed URL error:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
