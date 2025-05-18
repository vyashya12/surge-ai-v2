import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      console.error("Backend URL not configured");
      return NextResponse.json(
        { message: "Backend URL not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.data || !Array.isArray(body.data)) {
      console.error("Invalid request body: data is missing or not an array");
      return NextResponse.json(
        { message: "Invalid request body: data is missing or not an array" },
        { status: 400 }
      );
    }

    const response = await axios.post(
      `${backendUrl}/doctor-reply-suggestions`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        `Suggestions API error: HTTP ${error.response.status} - ${
          error.response.data?.message || error.message
        }`
      );
      return NextResponse.json(
        {
          message:
            error.response.data?.message || "Failed to fetch suggestions",
          status: error.response.status,
        },
        { status: error.response.status }
      );
    }
    console.error("Suggestions API error:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
