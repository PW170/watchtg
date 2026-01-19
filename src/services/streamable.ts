/**
 * Resolves a Streamable URL to a direct MP4 URL by scraping the page via a CORS proxy.
 */
export async function resolveStreamableUrl(url: string): Promise<string | null> {
    try {
        // Extract ID
        const match = url.match(/streamable\.com\/([a-zA-Z0-9]+)/);
        if (!match) return null;
        const id = match[1];

        // Use OpenGraph endpoint or Embed page
        // We use a CORS proxy to bypass "Access-Control-Allow-Origin" restriction on client-side
        // In production, this should be done via a backend or Edge Function.
        const targetUrl = `https://streamable.com/${id}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl);
        const html = await response.text();

        // Strategy 1: Look for og:video:url
        // <meta property="og:video:url" content="https://cdn-cf-east.streamable.com/video/mp4/..." />
        const ogMatch = html.match(/<meta property="og:video:url" content="([^"]+)"/);
        if (ogMatch && ogMatch[1]) {
            return ogMatch[1];
        }

        // Strategy 2: Look for video src in source tag
        // <source src="https://..." type="video/mp4">
        const sourceMatch = html.match(/src="([^"]+)" type="video\/mp4"/);
        if (sourceMatch && sourceMatch[1]) {
            return sourceMatch[1];
        }

        return null;
    } catch (error) {
        console.error('Failed to resolve Streamable URL:', error);
        return null;
    }
}
