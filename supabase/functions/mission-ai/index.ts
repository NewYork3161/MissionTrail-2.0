Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY is missing" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const message = body?.message;

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.6",
          input: message,
        }),
      },
    );

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error("OpenAI error:", data);

      return Response.json(
        {
          error: "OpenAI request failed",
          details: data,
        },
        { status: openaiResponse.status },
      );
    }

    const text =
      data?.output
        ?.flatMap((item: any) => item?.content ?? [])
        ?.find((item: any) => item?.type === "output_text")
        ?.text ?? "";

    return Response.json(
      { text },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 },
    );
  }
});
