"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError, login, register } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addFeed, deleteFeed, setSubscribed, updateFeed } from "@/lib/feeds";
import { endSession, requireUser, startSession } from "@/lib/session";
import { saveSettings } from "@/lib/settings";

export interface FormState {
  error?: string;
  ok?: boolean;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "");
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Unbekannter Fehler");

export async function authAction(_prev: FormState, form: FormData): Promise<FormState> {
  const mode = str(form, "mode");
  try {
    const run = mode === "register" ? register : login;
    const user = await run(getDb(), str(form, "email"), str(form, "password"));
    await startSession(user.id);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
  redirect(mode === "register" ? "/feeds" : "/articles");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function saveFeedAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const input = { name: str(form, "name"), url: str(form, "url"), icon: str(form, "icon") };
  const id = Number(form.get("id"));
  try {
    if (id) updateFeed(getDb(), user.id, id, input);
    else addFeed(getDb(), user.id, input);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleSubscriptionAction(form: FormData): Promise<void> {
  const user = await requireUser();
  setSubscribed(getDb(), user.id, Number(form.get("id")), form.get("subscribed") === "true");
  revalidatePath("/", "layout");
}

export async function deleteFeedAction(form: FormData): Promise<void> {
  const user = await requireUser();
  deleteFeed(getDb(), user.id, Number(form.get("id")));
  revalidatePath("/", "layout");
}

export async function saveSettingsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  saveSettings(getDb(), user.id, Object.fromEntries(form));
  revalidatePath("/", "layout");
  return { ok: true };
}
