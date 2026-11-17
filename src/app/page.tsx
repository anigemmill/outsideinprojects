import { redirect } from "next/navigation";
import { NotConfigured } from "@/components/auth/not-configured";
import { currentUser } from "@/lib/supabase/server";
import { authConfigured } from "@/server/env";

export default async function Home() {
  if (!authConfigured()) return <NotConfigured />;
  redirect((await currentUser()) ? "/account" : "/sign-in");
}
