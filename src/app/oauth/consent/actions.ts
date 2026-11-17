"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";

export async function answerConsent(form: FormData): Promise<void> {
  const authorizationId = String(form.get("authorization_id") ?? "");
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(authorizationId)) redirect("/account");
  await requireUser(`/oauth/consent?authorization_id=${authorizationId}`);
  const supabase = await supabaseServer();
  const approve = form.get("decision") === "approve";
  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) {
    console.warn("[auth] consent failed", { code: error?.code, status: error?.status });
    redirect(`/oauth/consent?authorization_id=${authorizationId}`);
  }
  // The client's registered redirect URI with a one-time code (approve) or access_denied (deny).
  redirect(data.redirect_url);
}
