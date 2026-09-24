// ============================================================
// COMPANION ROUTING
// Supabase Edge Function
// ============================================================
//
// PURPOSE:
//
// Receives:
//   {
//     action: "route",
//     origin: {
//       latitude: number,
//       longitude: number
//     },
//     destination: {
//       latitude: number,
//       longitude: number
//     }
//   }
//
// Calls OpenRouteService using the foot-walking profile.
//
// Returns:
//   {
//     coordinates: [
//       { latitude, longitude },
//       ...
//     ],
//     distanceMeters: number | null,
//     duration: number | null,
//     instructions: [
//       {
//         instruction,
//         name,
//         distance,
//         duration,
//         type,
//         way_points
//       },
//       ...
//     ]
//   }
//
// IMPORTANT:
//
// OpenRouteService GeoJSON uses:
//   [longitude, latitude]
//
// React Native Maps uses:
//   { latitude, longitude }
//
// This function converts between the two formats.
//
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


// ============================================================
// CONFIGURATION
// ============================================================

const ORS_API_URL =
  "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};


// ============================================================
// TYPES
// ============================================================

type Coordinate = {
  latitude: number;
  longitude: number;
};


type RouteRequest = {
  action?: "route";

  origin?: Coordinate;

  destination?: Coordinate;
};


type ORSStep = {
  distance?: number;

  duration?: number;

  instruction?: string;

  name?: string;

  type?: number;

  way_points?: [number, number];
};


type ORSSegment = {
  distance?: number;

  duration?: number;

  steps?: ORSStep[];
};


type ORSFeature = {
  geometry?: {
    type?: string;

    coordinates?: number[][];
  };

  properties?: {
    summary?: {
      distance?: number;

      duration?: number;
    };

    segments?: ORSSegment[];
  };
};


type ORSGeoJsonResponse = {
  type?: string;

  features?: ORSFeature[];
};


// ============================================================
// JSON RESPONSE
// ============================================================

function jsonResponse(
  body: unknown,
  status = 200,
): Response {

  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,

        "Content-Type":
          "application/json",
      },
    },
  );
}


// ============================================================
// COORDINATE VALIDATION
// ============================================================

function isCoordinate(
  value: unknown,
): value is Coordinate {

  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }


  const coordinate =
    value as Record<string, unknown>;


  const latitude =
    coordinate.latitude;


  const longitude =
    coordinate.longitude;


  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude)
  ) {
    return false;
  }


  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }


  if (
    latitude < -90 ||
    latitude > 90
  ) {
    return false;
  }


  if (
    longitude < -180 ||
    longitude > 180
  ) {
    return false;
  }


  return true;
}


// ============================================================
// NORMALIZE OPENROUTESERVICE GEOMETRY
// ============================================================

function normalizeRouteCoordinates(
  rawCoordinates: unknown,
): Coordinate[] {

  if (
    !Array.isArray(rawCoordinates)
  ) {
    return [];
  }


  const coordinates: Coordinate[] =
    [];


  for (
    const rawCoordinate
    of rawCoordinates
  ) {

    if (
      !Array.isArray(rawCoordinate) ||
      rawCoordinate.length < 2
    ) {
      continue;
    }


    const longitude =
      Number(rawCoordinate[0]);


    const latitude =
      Number(rawCoordinate[1]);


    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }


    coordinates.push({
      latitude,
      longitude,
    });
  }


  return coordinates;
}


// ============================================================
// NORMALIZE DIRECTIONS / INSTRUCTIONS
// ============================================================

function normalizeInstructions(
  segments: ORSSegment[],
) {

  const instructions: {
    instruction: string;
    name: string | null;
    distance: number | null;
    duration: number | null;
    type: number | null;
    way_points: [number, number] | null;
  }[] = [];


  for (
    const segment
    of segments
  ) {

    const steps =
      Array.isArray(segment.steps)
        ? segment.steps
        : [];


    for (
      const step
      of steps
    ) {

      if (
        typeof step.instruction !==
          "string" ||
        !step.instruction.trim()
      ) {
        continue;
      }


      instructions.push({
        instruction:
          step.instruction,

        name:
          typeof step.name === "string"
            ? step.name
            : null,

        distance:
          typeof step.distance === "number"
            ? step.distance
            : null,

        duration:
          typeof step.duration === "number"
            ? step.duration
            : null,

        type:
          typeof step.type === "number"
            ? step.type
            : null,

        way_points:
          Array.isArray(step.way_points) &&
          step.way_points.length >= 2
            ? [
                Number(
                  step.way_points[0],
                ),

                Number(
                  step.way_points[1],
                ),
              ]
            : null,
      });
    }
  }


  return instructions;
}


// ============================================================
// MAIN EDGE FUNCTION
// ============================================================

serve(
  async (
    req: Request,
  ): Promise<Response> => {

    // ========================================================
    // CORS
    // ========================================================

    if (
      req.method === "OPTIONS"
    ) {

      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }


    // ========================================================
    // METHOD VALIDATION
    // ========================================================

    if (
      req.method !== "POST"
    ) {

      return jsonResponse(
        {
          error:
            "Method not allowed.",
        },
        405,
      );
    }


    try {

      // ======================================================
      // OPENROUTESERVICE SECRET
      // ======================================================

      const orsApiKey =
        Deno.env.get(
          "OPENROUTESERVICE_API_KEY",
        );


      if (
        !orsApiKey
      ) {

        console.error(
          "OPENROUTESERVICE_API_KEY is not configured.",
        );


        return jsonResponse(
          {
            error:
              "OPENROUTESERVICE_API_KEY is not configured in Supabase Edge Function secrets.",
          },
          500,
        );
      }


      // ======================================================
      // READ REQUEST
      // ======================================================

      let body:
        RouteRequest;


      try {

        body =
          await req.json();

      } catch (
        error
      ) {

        console.error(
          "Could not parse routing request:",
          error,
        );


        return jsonResponse(
          {
            error:
              "Invalid JSON request body.",
          },
          400,
        );
      }


      // ======================================================
      // ACTION
      // ======================================================

      const action =
        body.action ??
        "route";


      if (
        action !== "route"
      ) {

        return jsonResponse(
          {
            error:
              `Unsupported routing action: ${String(action)}`,
          },
          400,
        );
      }


      // ======================================================
      // ORIGIN / DESTINATION
      // ======================================================

      const origin =
        body.origin;


      const destination =
        body.destination;


      if (
        !isCoordinate(origin)
      ) {

        return jsonResponse(
          {
            error:
              "A valid origin coordinate is required.",
          },
          400,
        );
      }


      if (
        !isCoordinate(destination)
      ) {

        return jsonResponse(
          {
            error:
              "A valid destination coordinate is required.",
          },
          400,
        );
      }


      // ======================================================
      // OPENROUTESERVICE REQUEST
      // ======================================================
      //
      // ORS expects:
      //
      // [longitude, latitude]
      //
      // NOT:
      //
      // [latitude, longitude]
      //
      // ======================================================

      const orsRequestBody = {
        coordinates: [
          [
            origin.longitude,
            origin.latitude,
          ],

          [
            destination.longitude,
            destination.latitude,
          ],
        ],

        instructions:
          true,
      };


      console.log(
        "Companion route request:",
        {
          origin,
          destination,
        },
      );


      const orsResponse =
        await fetch(
          ORS_API_URL,
          {
            method:
              "POST",

            headers: {
              Authorization:
                orsApiKey,

              "Content-Type":
                "application/json",

              Accept:
                "application/geo+json, application/json",
            },

            body:
              JSON.stringify(
                orsRequestBody,
              ),
          },
        );


      // ======================================================
      // OPENROUTESERVICE ERROR
      // ======================================================

      if (
        !orsResponse.ok
      ) {

        const errorText =
          await orsResponse.text();


        console.error(
          "OpenRouteService error:",
          orsResponse.status,
          errorText,
        );


        return jsonResponse(
          {
            error:
              `OpenRouteService returned HTTP ${orsResponse.status}.`,
          },
          502,
        );
      }


      // ======================================================
      // PARSE OPENROUTESERVICE RESPONSE
      // ======================================================

      const routeData =
        await orsResponse.json()
          as ORSGeoJsonResponse;


      const feature =
        Array.isArray(
          routeData.features,
        )
          ? routeData.features[0]
          : undefined;


      if (
        !feature
      ) {

        console.error(
          "OpenRouteService returned no route feature.",
          routeData,
        );


        return jsonResponse(
          {
            error:
              "OpenRouteService could not find a walking route.",
          },
          502,
        );
      }


      // ======================================================
      // ROUTE GEOMETRY
      // ======================================================

      const coordinates =
        normalizeRouteCoordinates(
          feature.geometry
            ?.coordinates,
        );


      if (
        coordinates.length < 2
      ) {

        console.error(
          "OpenRouteService returned invalid route geometry.",
          feature.geometry,
        );


        return jsonResponse(
          {
            error:
              "The routing service did not return valid route coordinates.",
          },
          502,
        );
      }


      // ======================================================
      // ROUTE SUMMARY
      // ======================================================

      const summary =
        feature.properties
          ?.summary;


      const segments =
        Array.isArray(
          feature.properties
            ?.segments,
        )
          ? feature.properties!
              .segments!
          : [];


      let distanceMeters:
        number | null =
          typeof summary
            ?.distance ===
            "number"
            ? summary.distance
            : null;


      let duration:
        number | null =
          typeof summary
            ?.duration ===
            "number"
            ? summary.duration
            : null;


      // ======================================================
      // SUMMARY FALLBACK
      // ======================================================
      //
      // Normally ORS supplies properties.summary.
      //
      // If it doesn't, calculate the totals from segments.
      //
      // ======================================================

      if (
        distanceMeters === null &&
        segments.length > 0
      ) {

        const distances =
          segments
            .map(
              (
                segment
              ) =>
                segment.distance,
            )

            .filter(
              (
                value
              ): value is number =>
                typeof value ===
                  "number",
            );


        if (
          distances.length > 0
        ) {

          distanceMeters =
            distances.reduce(
              (
                total,
                value,
              ) =>
                total +
                value,
              0,
            );
        }
      }


      if (
        duration === null &&
        segments.length > 0
      ) {

        const durations =
          segments
            .map(
              (
                segment
              ) =>
                segment.duration,
            )

            .filter(
              (
                value
              ): value is number =>
                typeof value ===
                  "number",
            );


        if (
          durations.length > 0
        ) {

          duration =
            durations.reduce(
              (
                total,
                value,
              ) =>
                total +
                value,
              0,
            );
        }
      }


      // ======================================================
      // TURN-BY-TURN INSTRUCTIONS
      // ======================================================

      const instructions =
        normalizeInstructions(
          segments,
        );


      // ======================================================
      // DEBUG LOG
      // ======================================================

      console.log(
        "Companion route calculated:",
        {
          coordinateCount:
            coordinates.length,

          distanceMeters,

          duration,

          instructionCount:
            instructions.length,
        },
      );


      // ======================================================
      // IMPORTANT:
      //
      // DO NOT wrap this in:
      //
      // {
      //   success: true,
      //   data: ...
      // }
      //
      // homebackup_companions.tsx expects these properties
      // directly on the Edge Function response.
      // ======================================================

      return jsonResponse(
        {
          coordinates,

          distanceMeters,

          duration,

          instructions,
        },
        200,
      );

    } catch (
      error
    ) {

      // ======================================================
      // UNEXPECTED ERROR
      // ======================================================

      console.error(
        "Unexpected companion-routing error:",
        error,
      );


      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "An unexpected routing error occurred.",
        },
        500,
      );
    }
  },
);