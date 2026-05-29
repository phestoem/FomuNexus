import { NextResponse } from "next/server";
import { isProtectedBlueprint } from "@/lib/nexus/blueprint-management";
import { updateBlueprintRequestSchema } from "@/lib/nexus/schemas";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ blueprintId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { blueprintId } = await context.params;
    const body = await request.json();
    const parsedBody = updateBlueprintRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const blueprint = await prisma.formBlueprint.findUnique({
      where: { id: blueprintId },
      select: { id: true, label: true },
    });

    if (!blueprint || isProtectedBlueprint(blueprint.label)) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const updated = await prisma.formBlueprint.update({
      where: { id: blueprintId },
      data: {
        archivedAt: parsedBody.data.archived ? new Date() : null,
      },
      select: {
        id: true,
        label: true,
        archivedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      label: updated.label,
      archivedAt: updated.archivedAt?.toISOString() ?? null,
      isArchived: updated.archivedAt !== null,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Update blueprint failed:", error);
    return NextResponse.json(
      { error: "Failed to update form." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { blueprintId } = await context.params;

    const blueprint = await prisma.formBlueprint.findUnique({
      where: { id: blueprintId },
      select: { id: true, label: true },
    });

    if (!blueprint || isProtectedBlueprint(blueprint.label)) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    await prisma.formBlueprint.delete({
      where: { id: blueprintId },
    });

    return NextResponse.json({ deleted: true, id: blueprintId });
  } catch (error) {
    console.error("Delete blueprint failed:", error);
    return NextResponse.json(
      { error: "Failed to delete form." },
      { status: 500 },
    );
  }
}
