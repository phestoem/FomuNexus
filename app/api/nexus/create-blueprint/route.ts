import { NextResponse } from "next/server";
import { buildFormUrl, resolveAppOrigin } from "@/lib/nexus/app-url";
import { createBlueprintFromPrompt } from "@/lib/nexus/create-blueprint-from-prompt";
import { createBlueprintRequestSchema } from "@/lib/nexus/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = createBlueprintRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const { title, prompt } = parsedBody.data;
    const origin = resolveAppOrigin(request);
    const { blueprint, session } = await createBlueprintFromPrompt({
      title,
      prompt,
    });

    return NextResponse.json({
      blueprint,
      session,
      url: buildFormUrl(session.id, origin),
    });
  } catch (error) {
    console.error("Create blueprint failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate and save the form blueprint.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
