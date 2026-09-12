import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";

export async function invokeFunction<TResponse, TBody extends object = Record<string, unknown>>(
  functionName: string,
  body: TBody,
): Promise<TResponse> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
    body: body as Record<string, unknown>,
  });

  if (error) {
    throw new Error(error.message || `Request to ${functionName} failed`);
  }
  if (data == null) {
    throw new Error(`Request to ${functionName} returned no response body`);
  }

  return data;
}
