import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization");

    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/diagnosis-validation-v2/unvalidated`,
      {
        headers: {
          ...(token ? { Authorization: token } : {}),
          "Content-Type": "application/json",
        },
      }
    );
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error("Error fetching diagnosis validations:", error);
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status || 500;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Failed to fetch diagnoses" },
      { status: 500 }
    );
  }
}
