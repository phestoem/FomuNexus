import { AppNav } from "@/components/ui/app-nav";

export default function FormLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div style={{ colorScheme: "light", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppNav variant="minimal" />
      {children}
    </div>
  );
}
