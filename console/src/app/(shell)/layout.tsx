import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EndpointBanner } from "@/components/endpoint-banner";
import { Sidebar } from "@/components/sidebar";
import { UserMenu } from "@/components/user-menu";

export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login"); // 纵深防御：middleware 之外再校验一层

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isAdmin={session.user.role === "admin"}
        userMenu={
          <UserMenu email={session.user.email ?? ""} role={session.user.role} />
        }
      />
      <div className="flex flex-1 flex-col overflow-auto">
        <EndpointBanner />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
