from __future__ import annotations

import re


def media_filename(shortcode: str, position: int, extension: str) -> str:
    safe_shortcode = re.sub(r"[^A-Za-z0-9_-]", "", shortcode)
    safe_extension = re.sub(r"[^A-Za-z0-9]", "", extension.lower()) or "bin"
    return f"instagram_{safe_shortcode}_{position:02d}.{safe_extension}"
