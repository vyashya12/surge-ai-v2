import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(
  req: NextRequest,
  { params }: { params: { summaryId: string } }
) {
  try {
    const { summaryId } = params;
    const token = req.headers.get("Authorization");

    const response = await axios.get(
      `http://13.215.163.56/summary/${summaryId}`,
      {
        headers: {
          ...(token ? { Authorization: token } : {}),
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Summary response:", response.data);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error("Error fetching summary:", error);
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status || 500;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}
