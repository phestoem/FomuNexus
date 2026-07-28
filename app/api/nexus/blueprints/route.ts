import { NextResponse } from "next/server";
import {
  buildBlueprintListOrderBy,
  buildBlueprintListWhere,
  isProtectedBlueprint,
} from "@/lib/nexus/blueprint-management";
import { reconcileReservedBlueprintLabelCollisions } from "@/lib/nexus/meta-blueprint";
import {
  listBlueprintsQuerySchema,
  manageBlueprintsRequestSchema,
} from "@/lib/nexus/schemas";
import { prisma } from "@/lib/prisma";
import { SessionStatus } from "@/app/generated/prisma/client";

function mapBlueprintSummary(
  blueprint: {
    id: string;
    label: string;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    sessions: { status: SessionStatus }[];
  },
) {
  const completedCount = blueprint.sessions.filter(
    (session) => session.status === SessionStatus.COMPLETED,
  ).length;

  return {
    id: blueprint.id,
    label: blueprint.label,
    createdAt: blueprint.createdAt.toISOString(),
    updatedAt: blueprint.updatedAt.toISOString(),
    archivedAt: blueprint.archivedAt?.toISOString() ?? null,
    isArchived: blueprint.archivedAt !== null,
    submissionCount: completedCount,
    sessionCount: blueprint.sessions.length,
  };
}

export async function GET(request: Request) {
  try {
    await reconcileReservedBlueprintLabelCollisions();

    const { searchParams } = new URL(request.url);
    const parsedQuery = listBlueprintsQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid query.", details: parsedQuery.error.flatten() },
        { status: 400 },
      );
    }

    const query = parsedQuery.data;
    const where = buildBlueprintListWhere(query);
    const skip = (query.page - 1) * query.limit;

    const [total, blueprints] = await Promise.all([
      prisma.formBlueprint.count({ where }),
      prisma.formBlueprint.findMany({
        where,
        orderBy: buildBlueprintListOrderBy(query.sort),
        skip,
        take: query.limit,
        select: {
          id: true,
          label: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
          sessions: {
            select: {
              status: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return NextResponse.json({
      forms: blueprints.map(mapBlueprintSummary),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("List blueprints failed:", error);
    return NextResponse.json(
      { error: "Failed to load forms." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = manageBlueprintsRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const { action, blueprintIds } = parsedBody.data;
    const uniqueIds = [...new Set(blueprintIds)];

    await reconcileReservedBlueprintLabelCollisions();

    const blueprints = await prisma.formBlueprint.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, label: true, targetSchema: true },
    });

    const manageable = blueprints.filter(
      (blueprint) => !isProtectedBlueprint(blueprint),
    );
    const manageableIds = manageable.map((blueprint) => blueprint.id);

    if (manageableIds.length === 0) {
      return NextResponse.json(
        { error: "No manageable forms matched the request." },
        { status: 404 },
      );
    }

    if (action === "delete") {
      await prisma.formBlueprint.deleteMany({
        where: { id: { in: manageableIds } },
      });
    } else {
      await prisma.formBlueprint.updateMany({
        where: { id: { in: manageableIds } },
        data: {
          archivedAt: action === "archive" ? new Date() : null,
        },
      });
    }

    return NextResponse.json({
      action,
      requestedCount: uniqueIds.length,
      affectedCount: manageableIds.length,
      skippedCount: uniqueIds.length - manageableIds.length,
    });
  } catch (error) {
    console.error("Bulk manage blueprints failed:", error);
    return NextResponse.json(
      { error: "Failed to update forms." },
      { status: 500 },
    );
  }
}
