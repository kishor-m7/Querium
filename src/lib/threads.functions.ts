import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type ThreadSummary = {
  id: string;
  title: string;
  updated_at: string;
  is_shared?: boolean;
};

export const ensureDemoUser = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const demoEmail = "demo.analyst@querium.ai";
    const demoPass = "QueriumDemo2026!";

    try {
      await supabaseAdmin.auth.admin.createUser({
        email: demoEmail,
        password: demoPass,
        email_confirm: true,
      });
    } catch {
      // Ignore if user already exists
    }

    return { email: demoEmail, password: demoPass };
  });

export const signUpUserDirectly = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error && !/already registered|already been registered/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary[]> => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, updated_at, is_shared")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as ThreadSummary[];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary> => {
    const { data, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: "New conversation" })
      .select("id, title, updated_at, is_shared")
      .single();
    if (error) throw new Error(error.message);
    return data as ThreadSummary;
  });

/**
 * Reuses the newest still-empty conversation instead of piling up blank threads
 * every time the user lands on /c.
 */
export const ensureThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary> => {
    const { data: recent, error: recentError } = await context.supabase
      .from("threads")
      .select("id, title, updated_at, is_shared")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentError) throw new Error(recentError.message);

    if (recent) {
      const { count, error: countError } = await context.supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", recent.id);
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) === 0) return recent as ThreadSummary;
    }

    const { data, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: "New conversation" })
      .select("id, title, updated_at, is_shared")
      .single();
    if (error) throw new Error(error.message);
    return data as ThreadSummary;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string; title: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ title: data.title.slice(0, 120) })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string }) => input)
  .handler(async ({ data, context }): Promise<{ title: string; is_shared: boolean; messages: Json[] }> => {
    const [threadRes, messagesRes] = await Promise.all([
      context.supabase.from("threads").select("title, is_shared").eq("id", data.threadId).maybeSingle(),
      context.supabase
        .from("messages")
        .select("content")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true }),
    ]);
    if (threadRes.error) throw new Error(threadRes.error.message);
    if (messagesRes.error) throw new Error(messagesRes.error.message);

    const messages = (messagesRes.data ?? [])
      .map((row) => row.content as Json)
      .filter(
        (message): message is Json =>
          !!message &&
          typeof message === "object" &&
          Array.isArray((message as Record<string, Json>)["parts"]),
      );

    return {
      title: threadRes.data?.title ?? "Conversation",
      is_shared: !!threadRes.data?.is_shared,
      messages,
    };
  });

export const toggleThreadShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string; isShared: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ is_shared: data.isShared })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSharedThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((input: { threadId: string }) => input)
  .handler(async ({ data }): Promise<{ title: string; messages: Json[] }> => {
    const [threadRes, messagesRes] = await Promise.all([
      supabase.from("threads").select("title").eq("id", data.threadId).maybeSingle(),
      supabase
        .from("messages")
        .select("content")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true }),
    ]);

    if (threadRes.error) throw new Error(threadRes.error.message);
    if (messagesRes.error) throw new Error(messagesRes.error.message);
    if (!threadRes.data) throw new Error("Thread not found or is private");

    const messages = (messagesRes.data ?? [])
      .map((row) => row.content as Json)
      .filter(
        (message): message is Json =>
          !!message &&
          typeof message === "object" &&
          Array.isArray((message as Record<string, Json>)["parts"]),
      );

    return {
      title: threadRes.data.title ?? "Shared Conversation",
      messages,
    };
  });

