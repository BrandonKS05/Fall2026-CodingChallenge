/** Image file types the pipeline accepts. Keys carry the extension so any storage backend can serve the right type. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const TYPE_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSION_BY_TYPE).map(([type, extension]) => [extension, type]),
);

export function extensionForContentType(contentType: string): string | null {
  return EXTENSION_BY_TYPE[contentType] ?? null;
}

export function contentTypeForKey(key: string): string {
  const extension = key.split('.').pop() ?? '';
  return TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
}
