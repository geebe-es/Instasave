from __future__ import annotations

import re


def media_filename(shortcode: str, position: int, extension: str, prefix: str = "instagram") -> str:
    safe_shortcode = re.sub(r"[^A-Za-z0-9_-]", "", shortcode)
    safe_extension = re.sub(r"[^A-Za-z0-9]", "", extension.lower()) or "bin"
    safe_prefix = re.sub(r"[^A-Za-z0-9_-]", "", prefix) or "media"
    return f"{safe_prefix}_{safe_shortcode}_{position:02d}.{safe_extension}"
