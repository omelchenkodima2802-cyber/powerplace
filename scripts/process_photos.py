from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(r"c:\Users\Dima\OneDrive\Desktop\PowerPlace")
IMAGES_DIR = ROOT / "images"
GALLERY_DIR = IMAGES_DIR / "gallery"
BAR_DIR = IMAGES_DIR / "bar"
MANIFEST_PATH = GALLERY_DIR / "manifest.json"

MAX_LONG_SIDE = 1600
THUMB_WIDTH = 800
BAR_SIZE = (900, 1125)
JPEG_QUALITY = 80
WEBP_QUALITY = 82

ALT_BY_CATEGORY = {
    "gym": "Силова зона Power Place",
    "reception": "Ресепшн Power Place",
    "locker": "Роздягальня Power Place",
    "massage": "Масажний кабінет Power Place",
}


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def fit_with_limit(size: tuple[int, int], max_side: int) -> tuple[int, int]:
    width, height = size
    long_side = max(width, height)
    if long_side <= max_side:
        return width, height
    scale = max_side / long_side
    return max(1, round(width * scale)), max(1, round(height * scale))


def resize_if_needed(image: Image.Image) -> Image.Image:
    target = fit_with_limit(image.size, MAX_LONG_SIDE)
    if target == image.size:
        return image.copy()
    return image.resize(target, Image.Resampling.LANCZOS)


def save_webp(image: Image.Image, destination: Path, quality: int = WEBP_QUALITY) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, format="WEBP", quality=quality, method=6)


def process_gallery() -> list[dict[str, object]]:
    ensure_dir(GALLERY_DIR)
    manifest: list[dict[str, object]] = []
    source_files = sorted(
        [
            path for path in GALLERY_DIR.glob("gallery-*.webp")
            if not path.stem.endswith("-sm")
        ],
        key=lambda path: int(path.stem.split("-")[1]),
    )

    for source_path in source_files:
        _, number, category = source_path.stem.split("-", 2)
        with Image.open(source_path) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            processed = resize_if_needed(image)
            if processed.size != image.size or source_path.stat().st_size > 250 * 1024:
                save_webp(processed, source_path)
            width, height = Image.open(source_path).size

        thumb_path = GALLERY_DIR / f"gallery-{number}-{category}-sm.webp"
        with Image.open(source_path) as source_image:
            current = ImageOps.exif_transpose(source_image).convert("RGB")
            thumb_width = min(THUMB_WIDTH, current.width)
            if thumb_width == current.width:
                thumb = current.copy()
            else:
                thumb = current.resize(
                    (thumb_width, max(1, round(current.height * (thumb_width / current.width)))),
                    Image.Resampling.LANCZOS,
                )
            save_webp(thumb, thumb_path)

        manifest.append(
            {
                "src": f"images/gallery/{source_path.name}",
                "srcSm": f"images/gallery/{thumb_path.name}",
                "category": category,
                "width": width,
                "height": height,
                "alt": ALT_BY_CATEGORY.get(category, "Power Place"),
            }
        )

    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def process_bar() -> list[dict[str, object]]:
    ensure_dir(BAR_DIR)
    source_files = sorted(
        GALLERY_DIR.glob("bar-*.webp"),
        key=lambda path: int(path.stem.split("-")[1]),
    )
    processed_paths = []
    for source_path in source_files:
        destination = BAR_DIR / source_path.name
        with Image.open(source_path) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            cropped = ImageOps.fit(
                image,
                BAR_SIZE,
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            save_webp(cropped, destination)
        processed_paths.append(destination)
    return [
        {
            "src": f"images/bar/{path.name}",
            "width": BAR_SIZE[0],
            "height": BAR_SIZE[1],
        }
        for path in processed_paths
    ]


if __name__ == "__main__":
    gallery_manifest = process_gallery()
    bar_manifest = process_bar()
    print(json.dumps({"gallery": len(gallery_manifest), "bar": len(bar_manifest)}, ensure_ascii=False))
