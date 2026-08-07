import { parseProfileExport } from "./profile-transfer.mjs?v=2026-08-07-grade-colors";

export const PROFILE_GIST_FILENAME = "mhn-field-kit-profile.json";
const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";

export function createProfileGistPayload(exportData) {
  return {
    description: "Monster Hunter Now Field Kit profile",
    public: false,
    files: {
      [PROFILE_GIST_FILENAME]: {
        content: JSON.stringify(exportData, null, 2),
      },
    },
  };
}

export function parseProfileFromGist(gist) {
  const file = gist?.files?.[PROFILE_GIST_FILENAME];
  if (!file?.content) {
    throw new Error(`The selected Gist does not contain ${PROFILE_GIST_FILENAME}.`);
  }
  return parseProfileExport(file.content);
}

export async function createProfileGist({ token, exportData }) {
  const response = await githubRequest("/gists", {
    method: "POST",
    token,
    body: createProfileGistPayload(exportData),
  });
  return {
    gistId: response.id,
    htmlUrl: response.html_url,
  };
}

export async function updateProfileGist({ token, gistId, exportData }) {
  const response = await githubRequest(`/gists/${gistId}`, {
    method: "PATCH",
    token,
    body: {
      files: createProfileGistPayload(exportData).files,
    },
  });
  return {
    gistId: response.id,
    htmlUrl: response.html_url,
  };
}

export async function loadProfileGist({ token, gistId }) {
  const gist = await githubRequest(`/gists/${gistId}`, {
    method: "GET",
    token,
  });
  return {
    profile: parseProfileFromGist(gist),
    htmlUrl: gist.html_url,
  };
}

async function githubRequest(path, { method, token, body }) {
  const response = await fetch(`${GITHUB_API_ROOT}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const message = await githubErrorMessage(response);
    throw new Error(message);
  }

  return response.json();
}

async function githubErrorMessage(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {}

  if (response.status === 401) {
    return "GitHub rejected that token. Use a personal access token with Gists access.";
  }
  if (response.status === 404) {
    return "That GitHub Gist was not found, or the token cannot access it.";
  }
  if (response.status === 403) {
    return payload?.message
      ? `GitHub blocked the request: ${payload.message}`
      : "GitHub blocked the request. Check your token permissions or rate limits.";
  }
  return payload?.message
    ? `GitHub API error: ${payload.message}`
    : `GitHub API error: ${response.status}`;
}
