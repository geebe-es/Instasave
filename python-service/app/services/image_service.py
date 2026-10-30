"""Lossless PNG encoding of decoded images, without resizing or sharpening."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps, ImageSequence

from app.models.media import ServiceError

# The desktop app intentionally has no image resolution limit.
Image.MAX_IMAGE_PIXELS = None


def convert_to_png(source: Path) -> tuple[Path, int, int]:
    destination = source.with_suffix('.png')
    temporary = destination.with_suffix('.png.tmp')
    try:
        with Image.open(source) as original:
            frame_count = getattr(original, 'n_frames', 1)
            frames, durations = [], []
            for frame in ImageSequence.Iterator(original):
                converted = ImageOps.exif_transpose(frame)
                if frame_count > 1:
                    converted = converted.convert('RGBA')
                elif converted.mode not in {'1', 'L', 'LA', 'P', 'RGB', 'RGBA', 'I', 'I;16'}:
                    converted = converted.convert('RGB')
                frames.append(converted.copy())
                durations.append(frame.info.get('duration', 0))
            first = frames[0]
            options = {}
            # Keep profiles only when the color space was not changed.
            if original.info.get('icc_profile') and original.mode == first.mode:
                options['icc_profile'] = original.info['icc_profile']
            exif = first.getexif()
            if exif:
                options['exif'] = exif.tobytes()
            if frame_count > 1:
                options.update(save_all=True, append_images=frames[1:], duration=durations,
                               loop=original.info.get('loop', 0), disposal=0, blend=0)
            with temporary.open('xb') as output:
                first.save(output, format='PNG', **options)
            width, height = first.size
        temporary.replace(destination)
        if source != destination:
            source.unlink(missing_ok=True)
        return destination, width, height
    except ServiceError:
        raise
    except (OSError, ValueError, SyntaxError) as error:
        raise ServiceError('IMAGE_CONVERSION_FAILED', 'Não foi possível converter esta imagem para PNG.', 502) from error
    finally:
        temporary.unlink(missing_ok=True)
