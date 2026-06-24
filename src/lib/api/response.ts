export async function throwIfResponseError(response: Response): Promise<void> {
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
