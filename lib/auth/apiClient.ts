export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = sessionStorage.getItem("access_token");

  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    const refreshRes = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      sessionStorage.setItem("access_token", data.accessToken);
      document.cookie = `session_token=${data.accessToken}; path=/; max-age=900; SameSite=Lax`;
      headers.set("Authorization", `Bearer ${data.accessToken}`);
      return fetch(url, { ...options, headers, credentials: "include" });
    }

    sessionStorage.clear();
    window.location.href = "/login";
  }

  return res;
}