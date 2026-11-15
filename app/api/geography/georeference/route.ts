import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const baseUrl = process.env.SOLAR3D_CORE_API_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "SOLAR3D_CORE_API_URL is not configured on the server." },
      { status: 503 },
    );
  }
  try {
    const payload = await request.json();
    const upstream = await fetch(new URL("/api/v1/geography/georeference", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Geographic coordinate service request failed." }, { status: 502 });
  }
}
