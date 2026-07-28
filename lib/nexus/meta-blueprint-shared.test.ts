import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssignableBlueprintLabel,
  buildConflictingBlueprintLabel,
  isMetaBlueprint,
  isReservedBlueprintLabel,
  matchesMetaTargetSchema,
  META_BLUEPRINT_LABEL,
  META_TARGET_SCHEMA,
  RESERVED_BLUEPRINT_LABEL_ERROR,
  resolveAssignableBlueprintLabel,
} from "@/lib/nexus/meta-blueprint-shared";

test("rejects the reserved creator co-pilot label for user-created forms", () => {
  assert.equal(isReservedBlueprintLabel(META_BLUEPRINT_LABEL), true);
  assert.equal(isReservedBlueprintLabel(` ${META_BLUEPRINT_LABEL} `), true);
  assert.equal(isReservedBlueprintLabel("Summer Block Party BBQ"), false);

  assert.throws(
    () => assertAssignableBlueprintLabel(META_BLUEPRINT_LABEL),
    (error: unknown) =>
      error instanceof Error && error.message === RESERVED_BLUEPRINT_LABEL_ERROR,
  );

  assert.equal(
    assertAssignableBlueprintLabel(" Hardware Server Failure Log "),
    "Hardware Server Failure Log",
  );
});

test("sanitizes compiled labels that collide with the reserved identity", () => {
  assert.equal(
    resolveAssignableBlueprintLabel(META_BLUEPRINT_LABEL),
    "Untitled Intake Form",
  );
  assert.equal(
    resolveAssignableBlueprintLabel("Workspace Pulse Check"),
    "Workspace Pulse Check",
  );
});

test("only treats reserved-label blueprints with the meta schema as co-pilot", () => {
  assert.equal(matchesMetaTargetSchema(META_TARGET_SCHEMA), true);
  assert.equal(
    matchesMetaTargetSchema({
      type: "object",
      required: ["guest_name"],
      properties: {
        guest_name: { type: "string", description: "Name" },
      },
    }),
    false,
  );

  assert.equal(
    isMetaBlueprint({
      label: META_BLUEPRINT_LABEL,
      targetSchema: META_TARGET_SCHEMA,
    }),
    true,
  );

  assert.equal(
    isMetaBlueprint({
      label: META_BLUEPRINT_LABEL,
      targetSchema: {
        type: "object",
        required: ["guest_name"],
        properties: {
          guest_name: { type: "string", description: "Name" },
        },
      },
    }),
    false,
  );

  assert.equal(
    isMetaBlueprint({
      label: "Ordinary form",
      targetSchema: META_TARGET_SCHEMA,
    }),
    false,
  );
});

test("renames colliding reserved labels into manageable titles", () => {
  const renamed = buildConflictingBlueprintLabel(
    META_BLUEPRINT_LABEL,
    "clashing_blueprint_ab12cd",
  );

  assert.equal(isReservedBlueprintLabel(renamed), false);
  assert.match(renamed, /ab12cd/);
});
