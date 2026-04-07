export type PluginCliParseResult<T> = { ok: true; value: T } | { ok: false; message: string };
