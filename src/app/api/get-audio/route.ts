import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import path from "path";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { filename } = req.query;
    if (typeof filename !== "string") {
      return res.status(400).json({ message: "Missing or invalid filename" });
    }

    const filePath = path.join(process.cwd(), "audio", filename);
    const buffer = await fs.readFile(filePath);
    const base64Data = buffer.toString("base64");

    res.status(200).json({ data: base64Data, mimetype: "audio/wav" });
  } catch (error) {
    console.error("Get audio error:", error);
    res.status(500).json({ message: "Failed to retrieve audio" });
  }
}
