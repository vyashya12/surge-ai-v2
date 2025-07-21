import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ doctorId: string }> }
) {
  try {
    const params = await context.params;
    const token = req.headers.get("Authorization");
    const { doctorId } = params;

    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/session-history/${doctorId}`,
      {
        headers: {
          ...(token ? { Authorization: token } : {}),
          "Content-Type": "application/json",
          accept: "application/json",
        },
      }
    );
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error("Error fetching session history:", error);
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status || 500;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Failed to fetch session history" },
      { status: 500 }
    );
  }
}
