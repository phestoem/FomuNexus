import type { Metadata } from "next";
import { BlueprintsList } from "@/components/admin/blueprints-list";

export const metadata: Metadata = {
  title: "Manage forms",
};

export default function BlueprintsPage() {
  return <BlueprintsList />;
}
