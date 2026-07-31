import { IntakeSessionForm } from "@/components/nexus/intake-session-form";

type FormSessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function FormSessionPage({ params }: FormSessionPageProps) {
  const { sessionId } = await params;

  return <IntakeSessionForm key={sessionId} sessionId={sessionId} />;
}
