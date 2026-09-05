"""Generates clearly-distinguishable 32x32 placeholder pixel-art PNGs.

Not real art: solid-color tiles with a bold letter/symbol, meant to be
swapped 1:1 for real sprites later (same file name, same 32x32 size).
"""
import os
from PIL import Image, ImageDraw, ImageFont

# プロジェクトルート (このスクリプトの1つ上の階層) の assets/images に出力する。
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "images")
SIZE = 32

os.makedirs(OUT, exist_ok=True)

try:
    FONT = ImageFont.truetype(
        "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf", 16
    )
    FONT_SMALL = ImageFont.truetype(
        "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf", 12
    )
except Exception:
    FONT = ImageFont.load_default()
    FONT_SMALL = FONT


def draw_centered_text(draw, text, font, fill="#ffffff", size=SIZE):
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]),
        text,
        font=font,
        fill=fill,
    )


def base_tile(bg, border="#00000055"):
    img = Image.new("RGBA", (SIZE, SIZE), bg)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, SIZE - 1, SIZE - 1], outline=border, width=1)
    return img, d


def save(img, name):
    img.save(os.path.join(OUT, f"{name}.png"))


def tile(name, bg, label, label_color="#ffffff", font=None):
    img, d = base_tile(bg)
    draw_centered_text(d, label, font or FONT, label_color)
    save(img, name)


def circle_icon(name, bg, fg, label, label_color="#1a1a1a"):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 2
    d.ellipse([pad, pad, SIZE - 1 - pad, SIZE - 1 - pad], fill=fg, outline="#00000066")
    draw_centered_text(d, label, FONT, label_color)
    save(img, name)


def item_icon(name, bg, label):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 3
    d.rounded_rectangle(
        [pad, pad, SIZE - 1 - pad, SIZE - 1 - pad],
        radius=6,
        fill=bg,
        outline="#00000066",
        width=1,
    )
    draw_centered_text(d, label, FONT_SMALL, "#ffffff")
    save(img, name)


# --- タイル ---
tile("tile_floor", "#e8ddc7", "")
tile("tile_start", "#a8d8a0", "S", "#134d13")
tile("tile_goal", "#ffd54a", "G", "#5c3d00")
tile("tile_gimmick_oneway", "#c9e4ff", "→", "#0b3d66")
tile("tile_gimmick_switch", "#ffcf91", "SW", "#663a00", FONT_SMALL)
tile("tile_gimmick_door_closed", "#8a6a4b", "門", "#ffffff", FONT_SMALL)
tile("tile_gimmick_door_open", "#c8b092", "門", "#5c3d00", FONT_SMALL)
tile("tile_gimmick_damagefloor", "#e57373", "×", "#5c0000")

for size, bg in [("small", "#c9a15a"), ("medium", "#b5883f"), ("large", "#e0b32a")]:
    tile(f"tile_chest_{size}", bg, "?", "#3a2600")
tile("tile_chest_opened", "#d8cba8", "済", "#5c4a1a", FONT_SMALL)

# --- 勇者 (向き別) ---
hero_colors = "#3b6fd6"
for direction, arrow in [("up", "▲"), ("down", "▼"), ("left", "◀"), ("right", "▶")]:
    circle_icon(f"hero_{direction}", "#3b6fd6", "#5f8fe8", arrow, "#ffffff")

# --- 敵 ---
enemies = {
    "enemy_slime": ("#4caf50", "ス"),
    "enemy_bat": ("#7e57c2", "コ"),
    "enemy_monster_box": ("#8d6e63", "箱"),
    "enemy_magic_book": ("#5c6bc0", "書"),
    "enemy_stone_statue": ("#616161", "石"),
}
for name, (color, label) in enemies.items():
    circle_icon(name, color, color, label, "#ffffff")

# --- アイテム ---
items = {
    "item_heal_potion_s": ("#e91e63", "小"),
    "item_heal_potion_m": ("#e91e63", "中"),
    "item_heal_potion_l": ("#e91e63", "大"),
    "item_shield_wood": ("#8d6e63", "木盾"),
    "item_shield_iron": ("#78909c", "鉄盾"),
    "item_shield_bronze": ("#a1662f", "銅盾"),
    "item_shield_silver": ("#b0bec5", "銀盾"),
    "item_shield_gold": ("#ffca28", "金盾"),
    "item_shield_platinum": ("#80deea", "白盾"),
    "item_weapon_club": ("#795548", "棍"),
    "item_weapon_iron_hammer": ("#607d8b", "鎚"),
    "item_weapon_bronze_spear": ("#a1662f", "槍"),
    "item_weapon_silver_axe": ("#b0bec5", "斧"),
    "item_weapon_gold_sword": ("#ffca28", "剣"),
    "item_weapon_platinum_greatsword": ("#80deea", "大剣"),
    "item_fruit_hp": ("#43a047", "HP実"),
    "item_fruit_attack": ("#e53935", "攻実"),
    "item_fruit_defense": ("#1e88e5", "防実"),
}
for name, (color, label) in items.items():
    item_icon(name, color, label)

print(f"generated {len(os.listdir(OUT))} files in {OUT}")
