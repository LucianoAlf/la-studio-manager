import { DashboardClientLayout } from "@/components/layout/dashboard-client-layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardClientLayout>{children}</DashboardClientLayout>
  );
}
