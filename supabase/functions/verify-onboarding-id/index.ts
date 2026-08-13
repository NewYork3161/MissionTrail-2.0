// ======================================================
// VERIFY ONBOARDING ID
// Supabase Edge Function
// PRE-ACCOUNT ID INFORMATION MATCHING
// ======================================================
//
// PURPOSE:
//
// 1. Receive the FRONT image of a user's ID.
// 2. Receive onboarding information entered by the user.
// 3. Send the ID image + entered information to OpenAI.
// 4. Ask AI to READ the visible ID information.
// 5. Compare visible information against onboarding data.
// 6. Return matched / mismatch / unable_to_verify to the app.
//
// IMPORTANT:
//
// This function intentionally runs BEFORE account creation.
// It does NOT require a signed-in Supabase user.
// It does NOT write to user_onboarding because no user_id exists yet.
//
// This is INFORMATION MATCHING only.
// It does NOT prove that:
// - the ID is genuine,
// - the ID was issued by a government,
// - the ID has not been altered,
// - the person submitting it is the person pictured.
//
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface IdentityFieldComparison {
  enteredValue?: string | null;
  idValue?: string | null;
  matched: boolean | null;
  confidence?: number | null;
}

interface VerificationComparisons {
  firstName?: IdentityFieldComparison;
  lastName?: IdentityFieldComparison;
  birthday?: IdentityFieldComparison;
  city?: IdentityFieldComparison;
  state?: IdentityFieldComparison;
  country?: IdentityFieldComparison;
}

interface OpenAIIdentityResult {
  documentReadable: boolean;
  appearsToBeIdentityDocument: boolean;

  extracted: {
    firstName: string | null;
    lastName: string | null;
    birthday: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };

  comparisons: VerificationComparisons;
  informationMatched: boolean;
  requiresManualReview: boolean;
  explanation: string;
}

// ======================================================
// CONSTANTS
// ======================================================

const OPENAI_MODEL = "gpt-4.1-mini";
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// ======================================================
// CORS
// ======================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

// ======================================================
// JSON RESPONSE
// ======================================================

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

// ======================================================
// CLEAN STRING
// ======================================================

function cleanString(
  value: FormDataEntryValue | null,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

// ======================================================
// NORMALIZE DATE
// ======================================================
//
// Converts common birthday formats to YYYY-MM-DD
// when possible.
//
// ======================================================

function normalizeDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  const cleaned = value.trim();

  // Already YYYY-MM-DD
  const isoMatch = cleaned.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  );

  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // MM/DD/YYYY
  const usMatch = cleaned.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  );

  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    const year = usMatch[3];

    return `${year}-${month}-${day}`;
  }

  return cleaned;
}

// ======================================================
// FILE -> BASE64
// ======================================================

async function fileToBase64(
  file: File,
): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  let binary = "";

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    const chunk = bytes.subarray(
      i,
      Math.min(
        i + chunkSize,
        bytes.length,
      ),
    );

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

// ======================================================
// PARSE OPENAI OUTPUT
// ======================================================

function getOpenAIText(
  response: any,
): string {
  if (
    typeof response?.output_text === "string" &&
    response.output_text.trim()
  ) {
    return response.output_text.trim();
  }

  const output =
    Array.isArray(response?.output)
      ? response.output
      : [];

  for (const item of output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (
        content?.type === "output_text" &&
        typeof content?.text === "string"
      ) {
        return content.text.trim();
      }
    }
  }

  return "";
}

// ======================================================
// COMPARISON JSON SCHEMA
// ======================================================

function comparisonSchema() {
  return {
    type: "object",
    additionalProperties: false,

    properties: {
      enteredValue: {
        type: [
          "string",
          "null",
        ],
      },

      idValue: {
        type: [
          "string",
          "null",
        ],
      },

      matched: {
        type: [
          "boolean",
          "null",
        ],
      },

      confidence: {
        type: [
          "number",
          "null",
        ],
      },
    },

    required: [
      "enteredValue",
      "idValue",
      "matched",
      "confidence",
    ],
  };
}

// ======================================================
// MAIN FUNCTION
// ======================================================
//
// PRE-ACCOUNT FLOW:
//
// This handler intentionally performs no Supabase user-session check.
//
// The caller does NOT need a Supabase user session.
// Supabase JWT verification must be disabled for this function.
//
// IMPORTANT:
// This endpoint is intentionally callable before account creation.
// Add CAPTCHA / rate limiting before production launch to reduce abuse.
//
// Supabase function JWT verification must also be disabled
// for this function:
//
// [functions.verify-onboarding-id]
// verify_jwt = false
//
// ======================================================

Deno.serve(async (req: Request) => {
      // ==================================================
      // CORS PREFLIGHT
      // ==================================================

      if (req.method === "OPTIONS") {
        return new Response(
          "ok",
          {
            headers: corsHeaders,
          },
        );
      }

      // ==================================================
      // POST ONLY
      // ==================================================

      if (req.method !== "POST") {
        return jsonResponse(
          {
            success: false,
            status: "error",
            message: "Method not allowed.",
          },
          405,
        );
      }

      try {
        // ==================================================
        // OPENAI SECRET
        // ==================================================

        const OPENAI_API_KEY =
          Deno.env.get(
            "OPENAI_API_KEY",
          );

        if (!OPENAI_API_KEY) {
          console.error(
            "OPENAI_API_KEY is not configured.",
          );

          return jsonResponse(
            {
              success: false,
              status: "error",
              errorType: "service_error",
              message:
                "The ID verification service is not configured.",
            },
            500,
          );
        }

        // ==================================================
        // READ MULTIPART FORM
        // ==================================================

        let formData: FormData;

        try {
          formData =
            await req.formData();
        } catch {
          return jsonResponse(
            {
              success: false,
              status: "error",
              errorType: "request_error",
              message:
                "The verification request was invalid.",
            },
            400,
          );
        }

        // ==================================================
        // ONBOARDING INFORMATION
        // ==================================================

        const firstName =
          cleanString(
            formData.get(
              "firstName",
            ),
          );

        const lastName =
          cleanString(
            formData.get(
              "lastName",
            ),
          );

        const displayName =
          cleanString(
            formData.get(
              "displayName",
            ),
          );

        const birthday =
          normalizeDate(
            cleanString(
              formData.get(
                "birthday",
              ),
            ),
          );

        const city =
          cleanString(
            formData.get(
              "city",
            ),
          );

        const state =
          cleanString(
            formData.get(
              "state",
            ),
          );

        const country =
          cleanString(
            formData.get(
              "country",
            ),
          );

        // ==================================================
        // REQUIRED FIELDS
        // ==================================================

        if (!firstName) {
          return jsonResponse(
            {
              success: false,
              status: "error",
              errorType: "request_error",
              message: "First name is required.",
            },
            400,
          );
        }

        if (!lastName) {
          return jsonResponse(
            {
              success: false,
              status: "error",
              errorType: "request_error",
              message: "Last name is required.",
            },
            400,
          );
        }

        if (!birthday) {
          return jsonResponse(
            {
              success: false,
              status: "error",
              errorType: "request_error",
              message: "Date of birth is required.",
            },
            400,
          );
        }

        // ==================================================
        // GET ID IMAGE
        // ==================================================

        const idImage =
          formData.get(
            "idImage",
          );

        if (!(idImage instanceof File)) {
          return jsonResponse(
            {
              success: false,
              status: "unable_to_verify",
              errorType: "image_error",
              message:
                "A front image of the ID is required.",
              informationMatched: false,
              requiresManualReview: true,
            },
            400,
          );
        }

        // ==================================================
        // IMAGE TYPE
        // ==================================================

        if (
          !idImage.type ||
          !idImage.type.startsWith(
            "image/",
          )
        ) {
          return jsonResponse(
            {
              success: false,
              status: "unable_to_verify",
              errorType: "image_error",
              message:
                "The uploaded file must be an image.",
              informationMatched: false,
              requiresManualReview: true,
            },
            400,
          );
        }

        // ==================================================
        // IMAGE SIZE
        // ==================================================

        if (
          idImage.size >
          MAX_IMAGE_SIZE_BYTES
        ) {
          return jsonResponse(
            {
              success: false,
              status: "unable_to_verify",
              errorType: "image_error",
              message:
                "The ID image is too large.",
              informationMatched: false,
              requiresManualReview: true,
            },
            413,
          );
        }

        // ==================================================
        // CONVERT IMAGE
        // ==================================================

        const base64Image =
          await fileToBase64(
            idImage,
          );

        const mimeType =
          idImage.type ||
          "image/jpeg";

        const imageDataUrl =
          `data:${mimeType};base64,${base64Image}`;

        // ==================================================
        // INSTRUCTIONS FOR AI
        // ==================================================

        const systemInstructions = `
You are assisting with an onboarding identity-information comparison.

Your ONLY task is to:

1. Inspect the FRONT image supplied by the user.
2. Determine whether it appears to contain an identity document with readable identity information.
3. Read only the identity fields needed for comparison.
4. Compare those readable fields with the onboarding information supplied by the application.
5. Return structured JSON.

You are NOT authenticating the physical document.

Do NOT claim:
- that the document is genuine,
- that it was actually issued by a government,
- that it has not been altered,
- that the person submitting it is the person pictured,
- or that the document passes forensic authentication.

If information is obscured, uncertain, missing, or unreadable, return null for that value and mark the comparison appropriately.

Names:
Ignore harmless differences in capitalization, punctuation, spacing, and obvious formatting.

Birthday:
Compare the actual calendar date, not formatting.

Location:
Only mark city, state, or country as mismatched when both the entered value and the ID value are sufficiently clear.

A missing optional location field should not by itself cause the entire verification to fail.

The required identity fields are:
- first name
- last name
- date of birth

For informationMatched to be true:
- first name must match,
- last name must match,
- birthday must match,
- and there must be no clear contradiction in another compared field.

If the image cannot be read reliably, set:
informationMatched = false
requiresManualReview = true
`;

        const userComparisonData = {
          firstName,
          lastName,
          displayName,
          birthday,
          city,
          state,
          country,
        };

        // ==================================================
        // OPENAI REQUEST
        // ==================================================

        const openAIResponse =
          await fetch(
            "https://api.openai.com/v1/responses",
            {
              method: "POST",

              headers: {
                "Authorization":
                  `Bearer ${OPENAI_API_KEY}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                model:
                  OPENAI_MODEL,

                instructions:
                  systemInstructions,

                input: [
                  {
                    role: "user",

                    content: [
                      {
                        type:
                          "input_text",

                        text:
                          `Compare the visible information on this ID image against the following onboarding information:\n\n${JSON.stringify(
                            userComparisonData,
                            null,
                            2,
                          )}`,
                      },

                      {
                        type:
                          "input_image",

                        image_url:
                          imageDataUrl,

                        detail:
                          "high",
                      },
                    ],
                  },
                ],

                text: {
                  format: {
                    type:
                      "json_schema",

                    name:
                      "identity_information_comparison",

                    strict:
                      true,

                    schema: {
                      type:
                        "object",

                      additionalProperties:
                        false,

                      properties: {
                        documentReadable: {
                          type:
                            "boolean",
                        },

                        appearsToBeIdentityDocument: {
                          type:
                            "boolean",
                        },

                        extracted: {
                          type:
                            "object",

                          additionalProperties:
                            false,

                          properties: {
                            firstName: {
                              type: [
                                "string",
                                "null",
                              ],
                            },

                            lastName: {
                              type: [
                                "string",
                                "null",
                              ],
                            },

                            birthday: {
                              type: [
                                "string",
                                "null",
                              ],
                            },

                            city: {
                              type: [
                                "string",
                                "null",
                              ],
                            },

                            state: {
                              type: [
                                "string",
                                "null",
                              ],
                            },

                            country: {
                              type: [
                                "string",
                                "null",
                              ],
                            },
                          },

                          required: [
                            "firstName",
                            "lastName",
                            "birthday",
                            "city",
                            "state",
                            "country",
                          ],
                        },

                        comparisons: {
                          type:
                            "object",

                          additionalProperties:
                            false,

                          properties: {
                            firstName:
                              comparisonSchema(),

                            lastName:
                              comparisonSchema(),

                            birthday:
                              comparisonSchema(),

                            city:
                              comparisonSchema(),

                            state:
                              comparisonSchema(),

                            country:
                              comparisonSchema(),
                          },

                          required: [
                            "firstName",
                            "lastName",
                            "birthday",
                            "city",
                            "state",
                            "country",
                          ],
                        },

                        informationMatched: {
                          type:
                            "boolean",
                        },

                        requiresManualReview: {
                          type:
                            "boolean",
                        },

                        explanation: {
                          type:
                            "string",
                        },
                      },

                      required: [
                        "documentReadable",
                        "appearsToBeIdentityDocument",
                        "extracted",
                        "comparisons",
                        "informationMatched",
                        "requiresManualReview",
                        "explanation",
                      ],
                    },
                  },
                },
              }),
            },
          );

        // ==================================================
        // OPENAI ERROR
        // ==================================================

        if (!openAIResponse.ok) {
          const errorText =
            await openAIResponse.text();

          console.error(
            "OpenAI verification request failed:",
            openAIResponse.status,
            errorText,
          );

          return jsonResponse(
            {
              success: false,
              status: "error",
              errorType: "service_error",
              message:
                "The AI verification service could not process the ID.",
              informationMatched: false,
              requiresManualReview: true,
            },
            502,
          );
        }

        // ==================================================
        // READ OPENAI RESPONSE
        // ==================================================

        const openAIData =
          await openAIResponse.json();

        const outputText =
          getOpenAIText(
            openAIData,
          );

        if (!outputText) {
          console.error(
            "OpenAI returned no structured text.",
          );

          return jsonResponse(
            {
              success: false,
              status:
                "unable_to_verify",
              errorType: "analysis_error",
              message:
                "The ID could not be analyzed.",
              informationMatched: false,
              requiresManualReview: true,
            },
            422,
          );
        }

        // ==================================================
        // PARSE STRUCTURED RESULT
        // ==================================================

        let aiResult:
          OpenAIIdentityResult;

        try {
          aiResult =
            JSON.parse(
              outputText,
            );
        } catch (error) {
          console.error(
            "Unable to parse AI result:",
            error,
          );

          return jsonResponse(
            {
              success: false,
              status:
                "unable_to_verify",
              errorType: "analysis_error",
              message:
                "The verification result could not be interpreted.",
              informationMatched: false,
              requiresManualReview: true,
            },
            422,
          );
        }

        // ==================================================
        // DETERMINE STATUS
        // ==================================================

        let verificationStatus:
          | "matched"
          | "mismatch"
          | "unable_to_verify";

        if (
          !aiResult.documentReadable ||
          !aiResult.appearsToBeIdentityDocument
        ) {
          verificationStatus =
            "unable_to_verify";
        } else if (
          aiResult.informationMatched
        ) {
          verificationStatus =
            "matched";
        } else {
          verificationStatus =
            "mismatch";
        }

        // ==================================================
        // RETURN RESULT
        // ==================================================
        //
        // There is intentionally NO database update here.
        // The user does not have an account/user_id yet.
        //
        // The client should:
        //
        // matched          -> onboarding_success
        // mismatch         -> mismatch card / retry
        // unable_to_verify -> retry/readability message
        // error            -> technical service error
        //
        // ==================================================

        return jsonResponse(
          {
            success:
              verificationStatus ===
              "matched",

            status:
              verificationStatus,

            message:
              verificationStatus ===
              "matched"
                ? "The information on the ID matches the onboarding information."
                : verificationStatus ===
                    "mismatch"
                  ? "Some information on the ID does not match the onboarding information."
                  : "The ID could not be verified automatically.",

            informationMatched:
              aiResult.informationMatched,

            requiresManualReview:
              aiResult.requiresManualReview,

            documentReadable:
              aiResult.documentReadable,

            appearsToBeIdentityDocument:
              aiResult.appearsToBeIdentityDocument,

            extracted:
              aiResult.extracted,

            comparisons:
              aiResult.comparisons,

            explanation:
              aiResult.explanation,
          },
          200,
        );
      } catch (error) {
        // ==================================================
        // UNEXPECTED ERROR
        // ==================================================

        console.error(
          "Unexpected verify-onboarding-id error:",
          error,
        );

        return jsonResponse(
          {
            success: false,
            status: "error",
            errorType: "service_error",
            message:
              "Something went wrong while checking the ID.",
            informationMatched: false,
            requiresManualReview: true,
          },
          500,
        );
      }
});