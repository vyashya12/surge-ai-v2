import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import path from "path";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ message: "Missing filename" });
    }

    const filePath = path.join(process.cwd(), "audio", filename);
    await fs.unlink(filePath);
    console.log(`Deleted audio file: ${filePath}`);

    res.status(200).json({ message: "File deleted" });
  } catch (error) {
    console.error("Delete audio error:", error);
    res.status(500).json({ message: "Failed to delete audio" });
  }
}
