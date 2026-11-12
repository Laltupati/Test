"""
Utility functions for video URL handling and conversion.
"""
import re
from urllib.parse import urlparse
from typing import Optional


def get_embed_url(url: Optional[str]) -> Optional[str]:
    """
    Converts a video platform URL to an embeddable URL.
    Supports YouTube, Vimeo, SharePoint, and OneDrive.
    """
    if not url:
        return None

    # YouTube URL patterns
    youtube_regex = r'^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})'
    youtube_match = re.match(youtube_regex, url)
    if youtube_match:
        return f'https://www.youtube.com/embed/{youtube_match.group(1)}'

    # Vimeo URL patterns
    vimeo_regex = r'(?:vimeo\.com\/)(\d+)'
    vimeo_match = re.search(vimeo_regex, url)
    if vimeo_match:
        return f'https://player.vimeo.com/video/{vimeo_match.group(1)}'

    # SharePoint Online video embed URL
    sharepoint_regex = r'^(?:https?:\/\/)?([^\/]+\.sharepoint\.com)\/sites\/([^\/]+)(?:\/.*)?$'
    sharepoint_match = re.match(sharepoint_regex, url)
    if sharepoint_match:
        tenant = sharepoint_match.group(1)
        site = sharepoint_match.group(2)
        video_id_match = re.search(r'[?&]videoId=([a-f0-9-]+)', url)
        if video_id_match:
            return f'https://{tenant}/sites/{site}/_layouts/15/embed.aspx?videoId={video_id_match.group(1)}'
        if '_layouts/15/embed.aspx' in url:
            return url

    # OneDrive video embed URL
    onedrive_regex = r'^(?:https?:\/\/)?([^\/]+-my\.sharepoint\.com)\/personal\/([^\/]+)'
    onedrive_match = re.match(onedrive_regex, url)
    if onedrive_match:
        tenant = onedrive_match.group(1)
        user = onedrive_match.group(2)
        video_id_match = re.search(r'[?&]videoId=([a-f0-9-]+)', url)
        if video_id_match:
            return f'https://{tenant}/personal/{user}/_layouts/15/embed.aspx?videoId={video_id_match.group(1)}'
        if '_layouts/15/embed.aspx' in url:
            return url

    # If it's already an embed URL or direct video file, return as-is
    return url


def generate_embed_code(url: Optional[str]) -> Optional[str]:
    """
    Generates an iframe embed code from a video URL.
    """
    if not url:
        return None

    embed_url = get_embed_url(url)
    if not embed_url:
        return None

    return (
        f'<iframe src="{embed_url}" frameborder="0" '
        f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
        f'allowfullscreen style="width: 100%; height: 100%;"></iframe>'
    )


def is_video_platform_url(url: Optional[str]) -> bool:
    """
    Checks if a URL is a video platform URL that needs conversion.
    """
    if not url:
        return False

    parsed = urlparse(url)
    if not parsed.hostname:
        parsed = urlparse(f'https://{url}')

    host = (parsed.hostname or '').lower()
    if not host:
        return False

    def is_host(domain: str) -> bool:
        return host == domain or host.endswith(f'.{domain}')

    return (
        is_host('youtube.com') or
        host == 'youtu.be' or
        is_host('vimeo.com') or
        is_host('sharepoint.com') or
        host == 'onedrive.com' or
        host == '1drv.ms'
    )
