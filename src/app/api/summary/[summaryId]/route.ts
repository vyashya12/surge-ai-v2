import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ summaryId: string }> }
) {
  try {
    const params = await context.params; // Await params to resolve the Promise
    const { summaryId } = params;
    const token = req.headers.get("Authorization");

    const response = await axios.get(
      `http://13.215.163.56/summary-v2/${summaryId}`,
      {
        headers: {
          ...(token ? { Authorization: token } : {}),
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status || 500;
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}
