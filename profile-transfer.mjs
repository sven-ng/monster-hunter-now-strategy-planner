export const PROFILE_EXPORT_VERSION = 1;

export function createProfileExport(profile, exportedAt = new Date().toISOString()) {
  return {
    app: "Monster Hunter Now Field Kit",
    version: PROFILE_EXPORT_VERSION,
    exportedAt,
    profile,
  };
}

export function parseProfileExportPayload(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  if (!payload || typeof payload !== "object" || payload.version !== PROFILE_EXPORT_VERSION || !payload.profile || typeof payload.profile !== "object") {
    throw new Error("That file is not a compatible Field Kit profile export.");
  }

  return payload;
}

export function parseProfileExport(text) {
  return parseProfileExportPayload(text).profile;
}
