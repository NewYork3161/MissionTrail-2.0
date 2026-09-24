// ======================================================
// COMPANION ROUTING
// Supabase Edge Function
// ======================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface RoutingRequestBody {
  origin: Coordinate;
  destination: Coordinate;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== "object") {
    return false;
  }
  const coord = value as Record<string, unknown>;
  return (
    typeof coord.latitude === "number" &&
    !isNaN(coord.latitude) &&
    typeof coord.longitude === "number" &&
    !isNaN(coord.longitude)
  );
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, message: "Method not allowed." },
      405,
    );
  }

  try {
    // Retrieve the OpenRouteService API key using the exact singular naming convention matching your dashboard secret
    const orsApiKey = Deno.env.get("OPENROUTESERVICE_API_KEY");

    if (!orsApiKey) {
      console.error("OPENROUTESERVICE_API_KEY is not configured in Supabase secrets.");
      return jsonResponse(
        {
          success: false,
          message: "Routing service is not properly configured.",
        },
        500,
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { success: false, message: "Invalid JSON payload." },
        400,
      );
    }

    const { origin, destination } = body as RoutingRequestBody;

    if (!isCoordinate(origin) || !isCoordinate(destination)) {
      return jsonResponse(
        {
          success: false,
          message:
            "Invalid or missing 'origin' and 'destination' coordinates. Both must include numeric latitude and longitude.",
        },
        400,
      );
    }

    // OpenRouteService expects [longitude, latitude] format
    const orsBody = {
      coordinates: [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
      ],
      instructions: true,
      geometry: true,
    };

    const orsResponse = await fetch(
      "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
      {
        method: "POST",
        headers: {
          "Authorization": orsApiKey,
          "Content-Type": "application/json",
          "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
        },
        body: JSON.stringify(orsBody),
      },
    );

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();
      console.error(
        "OpenRouteService API error:",
        orsResponse.status,
        errorText,
      );
      return jsonResponse(
        {
          success: false,
          message: "Failed to fetch routing data from external provider.",
        },
        502,
      );
    }

    const routeData = await orsResponse.json();

    return jsonResponse({
      success: true,
      data: routeData,
    });
  } catch (error) {
    console.error("Unexpected error in companion-routing function:", error);
    return jsonResponse(
      {
        success: false,
        message: "An unexpected error occurred while processing the route.",
      },
      500,
    );
  }
});