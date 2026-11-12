/**
 * Utility functions for video URL handling and conversion
 */

/**
 * Converts a video platform URL to an embeddable URL
 * Supports YouTube, Vimeo, SharePoint, and OneDrive
 */
export const getEmbedUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  // YouTube URL patterns
  const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo URL patterns
  const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // SharePoint Online video embed URL
  // Converts sharing URLs to embed URLs
  const sharepointRegex = /^(?:https?:\/\/)?([^\/]+\.sharepoint\.com)\/sites\/([^\/]+)(?:\/.*)?$/;
  const sharepointMatch = url.match(sharepointRegex);
  if (sharepointMatch) {
    const tenant = sharepointMatch[1];
    const site = sharepointMatch[2];
    // Try to extract video ID from query params or path
    const videoIdMatch = url.match(/[?&]videoId=([a-f0-9-]+)/);
    if (videoIdMatch) {
      return `https://${tenant}/sites/${site}/_layouts/15/embed.aspx?videoId=${videoIdMatch[1]}`;
    }
    // If already an embed URL, return as-is
    if (url.includes('_layouts/15/embed.aspx')) {
      return url;
    }
  }

  // OneDrive video embed URL
  const onedriveRegex = /^(?:https?:\/\/)?([^\/]+-my\.sharepoint\.com)\/personal\/([^\/]+)/;
  const onedriveMatch = url.match(onedriveRegex);
  if (onedriveMatch) {
    const tenant = onedriveMatch[1];
    const user = onedriveMatch[2];
    const videoIdMatch = url.match(/[?&]videoId=([a-f0-9-]+)/);
    if (videoIdMatch) {
      return `https://${tenant}/personal/${user}/_layouts/15/embed.aspx?videoId=${videoIdMatch[1]}`;
    }
    if (url.includes('_layouts/15/embed.aspx')) {
      return url;
    }
  }

  // If it's already an embed URL or direct video file, return as-is
  return url;
};

/**
 * Checks if a URL is a video platform URL that needs conversion
 */
export const isVideoPlatformUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return (
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('vimeo.com') ||
    url.includes('sharepoint.com') ||
    url.includes('onedrive.com') ||
    url.includes('1drv.ms')
  );
};

/**
 * Generates an iframe embed code from a video URL
 */
export const generateEmbedCode = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const embedUrl = getEmbedUrl(url);
  if (!embedUrl) return null;
  return `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="width: 100%; height: 100%;"></iframe>`;
};
