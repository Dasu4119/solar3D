import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";

export async function invokeFunction<TResponse>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
    body,
  });

  if (error) {
    throw new Error(error.message || `Request to ${functionName} failed`);
  }
  if (data == null) {
    throw new Error(`Request to ${functionName} returned no response body`);
  }

  return data;
}
