/**
 * @returns {Promise<RTCIceServer[]>}
 */
export async function fetchIceServers() {
  try {
    const response = await fetch("/ice-servers", { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.iceServers) ? data.iceServers : [];
  } catch (_) {
    return [];
  }
}
