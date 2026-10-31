import { invoke } from '@forge/bridge';

type Payload = Parameters<typeof invoke>[1];

/** Calls a backend resolver and unwraps the optional metadata envelope the bridge may return. */
export async function call<T>(functionKey: string, payload?: Payload): Promise<T> {
  const response = await invoke<T>(functionKey, payload);
  if (response && typeof response === 'object' && 'body' in response && 'metadata' in response) {
    return (response as { body: T }).body;
  }
  return response as T;
}
