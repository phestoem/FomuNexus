import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuestionPromptCapturedData,
  CREATOR_WORKING_TITLE_KEY,
  INITIAL_ROUGH_IDEA_KEY,
} from "@/lib/nexus/meta-blueprint-shared";
import { NEXUS_META_KEY } from "@/lib/nexus/target-schema";

test("creator co-pilot question prompts retain rough idea and working title", () => {
  const capturedData = {
    [CREATOR_WORKING_TITLE_KEY]: "Workspace Pulse",
    [INITIAL_ROUGH_IDEA_KEY]:
      "Draft survey about desk booking friction after the office move",
    primary_goal: "Understand desk booking pain",
    [NEXUS_META_KEY]: {
      injectedFields: [],
    },
  };

  const promptData = buildQuestionPromptCapturedData(capturedData, {
    includeCreatorContext: true,
  });

  assert.equal(promptData[CREATOR_WORKING_TITLE_KEY], "Workspace Pulse");
  assert.equal(
    promptData[INITIAL_ROUGH_IDEA_KEY],
    "Draft survey about desk booking friction after the office move",
  );
  assert.equal(promptData.primary_goal, "Understand desk booking pain");
  assert.equal(NEXUS_META_KEY in promptData, false);
});

test("ordinary respondent question prompts hide creator-only internal keys", () => {
  const capturedData = {
    [CREATOR_WORKING_TITLE_KEY]: "Should not appear",
    [INITIAL_ROUGH_IDEA_KEY]: "Should not appear either",
    guest_name: "Alex",
  };

  const promptData = buildQuestionPromptCapturedData(capturedData, {
    includeCreatorContext: false,
  });

  assert.equal(CREATOR_WORKING_TITLE_KEY in promptData, false);
  assert.equal(INITIAL_ROUGH_IDEA_KEY in promptData, false);
  assert.equal(promptData.guest_name, "Alex");
});
