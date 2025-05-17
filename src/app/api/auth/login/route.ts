import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: Request) {
  console.log("HIT");
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendUrl) {
      console.log("NO URL");
      return NextResponse.json(
        { message: "Backend URL not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const response = await axios.post(`${backendUrl}/login`, body, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log(response);

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, {
        status: error.response.status,
      });
    }
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
