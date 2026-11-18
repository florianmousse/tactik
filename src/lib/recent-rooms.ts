export const validRoomCode = (code: string) => /^(?:[A-Z2-9]{8}|[A-F0-9]{12})$/.test(code);
export function parseRecentRooms(value: string | null): string[] {
  try {
    const data: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(data)
      ? [
          ...new Set(data.filter((v): v is string => typeof v === 'string' && validRoomCode(v))),
        ].slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
export function rememberRoom(code: string, previous: string[]): string[] {
  return [code, ...previous.filter((c) => c !== code)].filter(validRoomCode).slice(0, 8);
}
