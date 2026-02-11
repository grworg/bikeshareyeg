#!/usr/bin/env python3
"""Generate placeholder images for BikeShareYEG documentation.

Each image is a light grey card with a subtle border, the description
text centered and wrapped, and a "PLACEHOLDER" watermark. Designed to
look clean in the docs layout and clearly communicate what the final
screenshot/illustration should contain.
"""

from PIL import Image, ImageDraw, ImageFont
import textwrap
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "docs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Try to load a clean system font
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def make_placeholder(filename: str, width: int, height: int, description: str, subtitle: str = ""):
    """Generate a single placeholder image."""
    img = Image.new("RGB", (width, height), "#f8f9fa")
    draw = ImageDraw.Draw(img)

    # Subtle border
    draw.rectangle([0, 0, width - 1, height - 1], outline="#e0e0e0", width=2)

    # Inner accent line (top)
    draw.rectangle([0, 0, width - 1, 4], fill="#d0d7de")

    # Watermark: "PLACEHOLDER" rotated diagonally
    try:
        wm_font = ImageFont.truetype(FONT_PATH, max(20, height // 12))
    except Exception:
        wm_font = ImageFont.load_default()

    wm_text = "PLACEHOLDER"
    wm_bbox = draw.textbbox((0, 0), wm_text, font=wm_font)
    wm_w = wm_bbox[2] - wm_bbox[0]
    wm_h = wm_bbox[3] - wm_bbox[1]

    # Draw watermark (faint, centered)
    wm_img = Image.new("RGBA", (wm_w + 40, wm_h + 20), (0, 0, 0, 0))
    wm_draw = ImageDraw.Draw(wm_img)
    wm_draw.text((20, 10), wm_text, fill=(0, 0, 0, 25), font=wm_font)
    wm_img = wm_img.rotate(15, expand=True, fillcolor=(0, 0, 0, 0))
    # Paste watermark centered
    paste_x = (width - wm_img.width) // 2
    paste_y = (height - wm_img.height) // 2
    img.paste(Image.alpha_composite(
        Image.new("RGBA", img.size, (248, 249, 250, 255)),
        Image.new("RGBA", img.size, (0, 0, 0, 0)),
    ).crop((0, 0, wm_img.width, wm_img.height)), (paste_x, paste_y), wm_img)

    # Icon placeholder (camera icon area)
    icon_y = height // 2 - 50
    icon_size = 36
    icon_x = width // 2
    draw.rounded_rectangle(
        [icon_x - icon_size, icon_y - icon_size, icon_x + icon_size, icon_y + icon_size],
        radius=8, outline="#bcc0c4", width=2,
    )
    # Simple camera icon
    draw.rounded_rectangle(
        [icon_x - 20, icon_y - 12, icon_x + 20, icon_y + 14],
        radius=4, outline="#9aa0a6", width=2,
    )
    draw.ellipse(
        [icon_x - 8, icon_y - 6, icon_x + 8, icon_y + 10],
        outline="#9aa0a6", width=2,
    )
    draw.polygon(
        [(icon_x - 10, icon_y - 12), (icon_x - 4, icon_y - 20), (icon_x + 4, icon_y - 20), (icon_x + 10, icon_y - 12)],
        outline="#9aa0a6", width=2,
    )

    # Description text (wrapped, centered, below the icon)
    try:
        desc_font = ImageFont.truetype(FONT_BOLD_PATH, max(14, min(18, width // 50)))
        sub_font = ImageFont.truetype(FONT_PATH, max(12, min(14, width // 60)))
    except Exception:
        desc_font = ImageFont.load_default()
        sub_font = desc_font

    # Wrap description
    max_chars = max(30, width // 12)
    lines = textwrap.wrap(description, width=max_chars)

    text_y = icon_y + icon_size + 20
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=desc_font)
        tw = bbox[2] - bbox[0]
        draw.text(((width - tw) // 2, text_y), line, fill="#5f6368", font=desc_font)
        text_y += bbox[3] - bbox[1] + 6

    # Subtitle
    if subtitle:
        text_y += 4
        sub_lines = textwrap.wrap(subtitle, width=max_chars + 10)
        for line in sub_lines:
            bbox = draw.textbbox((0, 0), line, font=sub_font)
            tw = bbox[2] - bbox[0]
            draw.text(((width - tw) // 2, text_y), line, fill="#9aa0a6", font=sub_font)
            text_y += bbox[3] - bbox[1] + 4

    # Dimension label (bottom right)
    dim_text = f"{width}x{height}"
    try:
        dim_font = ImageFont.truetype(FONT_PATH, 11)
    except Exception:
        dim_font = ImageFont.load_default()
    draw.text((width - 70, height - 20), dim_text, fill="#c0c4c8", font=dim_font)

    out_path = OUTPUT_DIR / filename
    img.save(out_path, "PNG", optimize=True)
    print(f"  {filename} ({width}x{height})")


# ---------------------------------------------------------------------------
# Image definitions
# ---------------------------------------------------------------------------

IMAGES = [
    # (filename, width, height, description, subtitle)
    (
        "hero-banner.png", 960, 300,
        "BikeShareYEG — Edmonton's Bike-Share Planning Tool",
        "Wide hero showing the map with suitability overlay, stations, and sidebar UI",
    ),
    (
        "app-overview.png", 800, 450,
        "Full Application Overview",
        "Screenshot of the complete UI: map, sidebar, stations on map, suitability hex overlay",
    ),
    (
        "ui-modes.png", 800, 380,
        "Three Application Modes",
        "Annotated screenshot showing Trip Planner, Network Designer, and Saved Networks nav icons",
    ),
    (
        "route-results.png", 800, 500,
        "Multi-Modal Route Results",
        "Route panel showing walk, bike, bike-share, and transit options with durations and legs",
    ),
    (
        "network-designer.png", 800, 450,
        "Network Designer with Suitability Overlay",
        "Map with hex suitability heatmap, placed stations, and planner controls sidebar",
    ),
    (
        "suitability-hexgrid.png", 800, 400,
        "Suitability Surface Close-Up",
        "Zoomed hex grid showing color gradients, with a clicked hex showing factor breakdown popup",
    ),
    (
        "algorithm-comparison.png", 800, 360,
        "Greedy vs Iterative MCLP — Station Placement Comparison",
        "Side-by-side maps: left = greedy result, right = MCLP result for the same parameters",
    ),
    (
        "step-mode-sequence.png", 800, 280,
        "Step-by-Step Placement: 3 Frames",
        "Three panels showing station count 1, 5, and 15 — heatmap evolving with each placement",
    ),
    (
        "constraints-diagram.png", 800, 400,
        "Constraints & Modifiers Visualization",
        "Diagram showing min spacing radius, proximity discount zone, and connectivity pull zone around stations",
    ),
    (
        "architecture-diagram.png", 800, 380,
        "System Architecture Diagram",
        "Clean diagram: Next.js frontend ↔ REST API ↔ FastAPI backend with data source connections",
    ),
    (
        "layer-stack.png", 800, 340,
        "Map Rendering Layer Stack",
        "Stacked layers: base map tiles → GeoJSON overlays → ScatterplotLayer stations → HTML popups",
    ),
    (
        "bikeshare-routing.png", 800, 400,
        "Bike-Share Routing Logic",
        "Diagram: origin → walk → pickup dock → bike ride → drop-off dock → walk → destination",
    ),
    (
        "elevation-profile.png", 800, 280,
        "Route Elevation Profile",
        "Chart showing distance vs elevation along a route, with ascent/descent stats",
    ),
    (
        "station-popup.png", 600, 340,
        "Station Click Popup",
        "Station metadata card showing name, bikes, capacity, suitability, and delete button",
    ),
    (
        "data-sources-map.png", 800, 400,
        "Data Sources Overlay",
        "Map with LRT lines, bike paths, bus routes, and population density all toggled on",
    ),
    (
        "saved-networks.png", 600, 380,
        "Saved Networks Panel",
        "List of saved network drafts with names, dates, station counts, and load/delete actions",
    ),
]

# ---------------------------------------------------------------------------
# Generate all
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Generating {len(IMAGES)} placeholder images → {OUTPUT_DIR}/")
    for args in IMAGES:
        make_placeholder(*args)
    print("Done.")
