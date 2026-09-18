import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/auth/session";

export default async function HomePage() {
  const context = await getAppContext();
  redirect(context ? "/dashboard" : "/login");
}
