import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(
  req: NextRequest,
  { params }: { params: { doctorId: string } }
) {
  try {
    const token = req.headers.get("Authorization");
    const { doctorId } = params;

    const response = await axios.get(
      `http://13.215.163.56/session-history/${doctorId}`,
      {
        headers: {
          ...(token ? { Authorization: token } : {}),
          "Content-Type": "application/json",
          accept: "application/json",
        },
      }
    );
    console.log("Session history response:", response.data);
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
