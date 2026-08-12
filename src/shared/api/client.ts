import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";

export async function invokeFunction<TResponse>(
  functionName: string,
  body: unknown,
): Promise<TResponse> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
    body,
  });

  if (error) {
    throw new Error(error.message || `Request to ${functionName} failed`);
  }

  return data;
}
