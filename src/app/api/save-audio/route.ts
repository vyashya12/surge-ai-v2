import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import path from "path";
import { ensureDir } from "fs-extra";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const audioDir = path.join(process.cwd(), "audio");
    await ensureDir(audioDir);

    const { sessionId, audio } = req.body;
    if (!sessionId || !audio || !audio.data) {
      return res
        .status(400)
        .json({ message: "Missing sessionId or audio data" });
    }

    const filename = `session-${sessionId}.wav`;
    const filePath = path.join(audioDir, filename);
    const buffer = Buffer.from(audio.data, "base64");
    await fs.writeFile(filePath, buffer);

    console.log(`Saved audio to ${filePath}`);
    res.status(200).json({ filename });
  } catch (error) {
    console.error("Save audio error:", error);
    res.status(500).json({ message: "Failed to save audio" });
  }
}
