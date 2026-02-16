'use client';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Phase 2 — add auth guard here
  return <>{children}</>;
}
