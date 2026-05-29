import type { Prisma } from "@/app/generated/prisma/client";
import { META_BLUEPRINT_LABEL } from "@/lib/nexus/meta-blueprint-shared";
import type { listBlueprintsQuerySchema } from "@/lib/nexus/schemas";
import type { z } from "zod";

export type ListBlueprintsQuery = z.infer<typeof listBlueprintsQuerySchema>;

export function buildBlueprintListWhere(
  query: ListBlueprintsQuery,
): Prisma.FormBlueprintWhereInput {
  const where: Prisma.FormBlueprintWhereInput = {
    label: {
      not: META_BLUEPRINT_LABEL,
    },
  };

  if (query.status === "active") {
    where.archivedAt = null;
  } else if (query.status === "archived") {
    where.archivedAt = { not: null };
  }

  const search = query.q?.trim();
  if (search) {
    where.label = {
      not: META_BLUEPRINT_LABEL,
      contains: search,
      mode: "insensitive",
    };
  }

  return where;
}

export function buildBlueprintListOrderBy(
  sort: ListBlueprintsQuery["sort"],
): Prisma.FormBlueprintOrderByWithRelationInput {
  switch (sort) {
    case "updated_asc":
      return { updatedAt: "asc" };
    case "name_asc":
      return { label: "asc" };
    case "name_desc":
      return { label: "desc" };
    case "updated_desc":
    default:
      return { updatedAt: "desc" };
  }
}

export function isProtectedBlueprint(label: string): boolean {
  return label === META_BLUEPRINT_LABEL;
}
