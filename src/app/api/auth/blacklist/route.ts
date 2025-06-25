import { NextRequest, NextResponse } from "next/server";

// In production, use Redis or database
const blacklistedUserIds = new Set<string>();

function extractUserIdFromToken(token: string): string | null {
  const match = token.match(/^token_([^_]+)_/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    blacklistedUserIds.add(userId);
    return NextResponse.json({ message: "User blacklisted" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to blacklist user" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ blacklisted: false });
  
  const userId = extractUserIdFromToken(token);
  const isBlacklisted = userId ? blacklistedUserIds.has(userId) : false;
  return NextResponse.json({ blacklisted: isBlacklisted });
}