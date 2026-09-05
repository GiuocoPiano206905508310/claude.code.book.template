"""高品質ドット絵プレースホルダー生成。
64x64キャンバスにPILの図形プリミティブ（矩形/楕円/多角形）だけで
輪郭・陰影・ハイライトを持つシルエットを描き、最後にアウトラインを
1pxで締める。アンチエイリアスは使わずハードエッジのみにして
ドット絵らしい見た目にする。
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "images")
S = 64  # キャンバスサイズ
os.makedirs(OUT, exist_ok=True)

def canvas():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def save(img, name):
    img.save(os.path.join(OUT, f"{name}.png"))

def outline(draw, points, color, width=2, closed=True):
    pts = points + [points[0]] if closed else points
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=width, joint="curve")

def tilted_bar(cx, cy, length, width, angle_deg):
    """中心(cx,cy)・長さ・太さ・角度(度, 0=水平右向き)の矩形の4頂点を返す。"""
    a = math.radians(angle_deg)
    dx, dy = math.cos(a), math.sin(a)
    nx, ny = -dy, dx
    hl, hw = length / 2, width / 2
    pts = [
        (cx + dx * hl + nx * hw, cy + dy * hl + ny * hw),
        (cx - dx * hl + nx * hw, cy - dy * hl + ny * hw),
        (cx - dx * hl - nx * hw, cy - dy * hl - ny * hw),
        (cx + dx * hl - nx * hw, cy + dy * hl - ny * hw),
    ]
    return pts

def tip_point(cx, cy, length, angle_deg):
    a = math.radians(angle_deg)
    return (cx + math.cos(a) * length, cy + math.sin(a) * length)

INK = (26, 20, 16, 255)  # 輪郭線の濃い色

# ---------------------------------------------------------------------------
# 素材ティア パレット (base, shadow, light)
# ---------------------------------------------------------------------------
TIER = {
    "wood":     ((150, 100, 58), (98, 62, 30), (196, 152, 100)),
    "iron":     ((150, 163, 173), (95, 106, 115), (206, 216, 222)),
    "bronze":   ((193, 123, 46), (130, 78, 22), (230, 172, 96)),
    "silver":   ((205, 214, 220), (148, 158, 166), (240, 246, 249)),
    "gold":     ((233, 188, 61), (170, 128, 26), (255, 227, 130)),
    "platinum": ((129, 224, 214), (63, 157, 148), (205, 255, 249)),
}

def rr(draw, box, radius, fill=None, outline_c=None, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline_c, width=width)

# ---------------------------------------------------------------------------
# 盾 (6段階)
# ---------------------------------------------------------------------------
def draw_shield(name, tier, fancy=False):
    img, d = canvas()
    base, shadow, light = TIER[tier]
    cx = S / 2
    top = 10
    pts = [(cx - 17, top), (cx + 17, top), (cx + 19, 30), (cx, 56), (cx - 19, 30)]
    d.polygon(pts, fill=base)
    # 左上ハイライト
    d.polygon([(cx - 17, top), (cx, top), (cx - 2, 30), (cx - 19, 30)], fill=light)
    # 右下シャドウ
    d.polygon([(cx + 4, 22), (cx + 19, 30), (cx, 56), (cx - 4, 40)], fill=shadow)
    outline(d, pts, INK, 3)
    # 中央エンブレム
    if fancy:
        d.ellipse([cx - 7, 24, cx + 7, 38], fill=light, outline=INK, width=2)
        d.ellipse([cx - 3, 28, cx + 3, 34], fill=base)
    else:
        d.polygon([(cx, 20), (cx + 8, 30), (cx, 40), (cx - 8, 30)], fill=light, outline=INK)
    for rx in (cx - 12, cx + 12):
        d.ellipse([rx - 3, 15, rx + 3, 21], fill=shadow, outline=INK, width=1)
    save(img, name)

# ---------------------------------------------------------------------------
# 武器 (種類ごとに別シルエット、色はティア)
# ---------------------------------------------------------------------------
def draw_club(name):
    img, d = canvas()
    base, shadow, light = TIER["wood"]
    handle = tilted_bar(28, 42, 30, 7, -55)
    d.polygon(handle, fill=base, outline=INK)
    d.ellipse([32, 8, 54, 30], fill=base, outline=INK, width=3)
    d.ellipse([36, 12, 46, 22], fill=light)
    for sx, sy in [(38, 14), (47, 20), (40, 24)]:
        d.ellipse([sx - 2, sy - 2, sx + 2, sy + 2], fill=shadow)
    save(img, name)

def draw_hammer(name):
    img, d = canvas()
    base, shadow, light = TIER["iron"]
    wbase, wshadow, _ = TIER["wood"]
    handle = tilted_bar(26, 44, 34, 6, -55)
    d.polygon(handle, fill=wbase, outline=INK)
    d.rectangle([30, 8, 56, 26], fill=base, outline=INK, width=3)
    d.rectangle([30, 8, 40, 26], fill=light)
    d.rectangle([46, 8, 56, 26], fill=shadow)
    save(img, name)

def draw_spear(name):
    img, d = canvas()
    base, shadow, light = TIER["bronze"]
    wbase, _, _ = TIER["wood"]
    shaft = tilted_bar(30, 40, 44, 5, -55)
    d.polygon(shaft, fill=wbase, outline=INK)
    tip = tip_point(30, 40, 34, -55)
    left = tip_point(30, 40, 20, -55 - 18)
    right = tip_point(30, 40, 20, -55 + 18)
    d.polygon([tip, left, right], fill=base, outline=INK, width=2)
    d.polygon([tip, left, (30 - 8, 22)], fill=light)
    save(img, name)

def draw_axe(name):
    img, d = canvas()
    base, shadow, light = TIER["silver"]
    wbase, _, _ = TIER["wood"]
    handle = tilted_bar(30, 44, 38, 6, -55)
    d.polygon(handle, fill=wbase, outline=INK)
    head_c = tip_point(30, 44, 24, -55)
    blade = [
        (head_c[0], head_c[1] - 4),
        (head_c[0] + 20, head_c[1] - 16),
        (head_c[0] + 16, head_c[1] + 2),
        (head_c[0] + 20, head_c[1] + 16),
        (head_c[0], head_c[1] + 6),
    ]
    d.polygon(blade, fill=base, outline=INK, width=2)
    d.polygon([blade[0], blade[1], blade[2]], fill=light)
    save(img, name)

def draw_sword(name, tier, big=False):
    img, d = canvas()
    base, shadow, light = TIER[tier]
    length = 40 if big else 34
    width = 8 if big else 6
    blade = tilted_bar(32, 34, length, width, -55)
    d.polygon(blade, fill=light, outline=INK, width=2)
    tip = tip_point(32, 34, length / 2 + 8, -55)
    side_a = tilted_bar(32, 34, length, 2, -55)
    d.line([blade[0], tip], fill=INK, width=1)
    d.polygon([blade[0], blade[3], tip], fill=base)
    # クロスガード
    guard = tilted_bar(32 - math.cos(math.radians(-55)) * (length/2), 34 - math.sin(math.radians(-55)) * (length/2),
                        big and 20 or 16, big and 6 or 5, -55 + 90)
    d.polygon(guard, fill=TIER["gold" if big else "iron"][0], outline=INK, width=2)
    # 柄
    grip_c = tip_point(32, 34, length / 2 + 8, 125)
    grip = tilted_bar(grip_c[0], grip_c[1], 14, 5, -55)
    d.polygon(grip, fill=(90, 60, 40, 255), outline=INK)
    if big:
        pommel = tip_point(32, 34, length / 2 + 15, 125)
        d.ellipse([pommel[0]-4, pommel[1]-4, pommel[0]+4, pommel[1]+4], fill=TIER["platinum"][2], outline=INK)
    save(img, name)

# ---------------------------------------------------------------------------
# 実 (HP/攻撃/防御)
# ---------------------------------------------------------------------------
def draw_fruit(name, base, shadow, light):
    img, d = canvas()
    d.ellipse([16, 22, 48, 54], fill=base, outline=INK, width=3)
    d.pieslice([16, 22, 48, 54], 200, 300, fill=shadow)
    d.ellipse([22, 27, 32, 36], fill=light)
    d.line([(34, 16), (30, 22)], fill=(90, 60, 30, 255), width=3)
    d.polygon([(34, 14), (44, 10), (38, 20)], fill=(90, 170, 90, 255), outline=INK, width=1)
    save(img, name)

# ---------------------------------------------------------------------------
# 回復薬 (小/中/大)
# ---------------------------------------------------------------------------
def draw_potion(name, scale, liquid):
    img, d = canvas()
    cx = S / 2
    body_h = 22 * scale
    body_w = 24 * scale
    top = 62 - body_h
    d.rectangle([cx - 4, 10, cx + 4, top + 6], fill=(200, 210, 216, 255), outline=INK, width=2)
    d.rectangle([cx - 6, 6, cx + 6, 12], fill=(120, 80, 50, 255), outline=INK, width=2)
    box = [cx - body_w / 2, top, cx + body_w / 2, top + body_h]
    d.ellipse(box, fill=(230, 240, 245, 235), outline=INK, width=3)
    inner = [box[0] + 4, box[1] + 8, box[2] - 4, box[3] - 4]
    d.pieslice(inner, 0, 360, fill=liquid)
    d.pieslice(box, 0, 180, fill=None)
    d.ellipse([box[0] + 6, box[1] + 10, box[0] + 14, box[1] + 20], fill=(255, 255, 255, 130))
    save(img, name)

# ---------------------------------------------------------------------------
# 勇者 (4方向)
# ---------------------------------------------------------------------------
SKIN = (240, 195, 150, 255)
HAIR = (94, 60, 34, 255)
TUNIC = (58, 122, 168, 255)
TUNIC_D = (38, 88, 128, 255)
PANTS = (74, 54, 38, 255)
BLADE = (215, 222, 228, 255)

def draw_hero(name, facing):
    img, d = canvas()
    cx = 32
    # 影
    d.ellipse([cx - 14, 54, cx + 14, 60], fill=(0, 0, 0, 70))
    # 脚
    d.rectangle([cx - 9, 42, cx - 2, 56], fill=PANTS, outline=INK, width=2)
    d.rectangle([cx + 2, 42, cx + 9, 56], fill=PANTS, outline=INK, width=2)
    # 胴
    d.rounded_rectangle([cx - 13, 22, cx + 13, 46], radius=6, fill=TUNIC, outline=INK, width=3)
    d.rectangle([cx - 13, 34, cx - 4, 46], fill=TUNIC_D)
    d.rectangle([cx - 13, 40, cx + 13, 44], fill=(212, 175, 60, 255), outline=INK, width=1)  # ベルト
    # 頭
    d.ellipse([cx - 11, 6, cx + 11, 26], fill=SKIN, outline=INK, width=3)

    if facing == "down":
        d.pieslice([cx - 12, 3, cx + 12, 20], 180, 360, fill=HAIR, outline=INK, width=2)
        d.ellipse([cx - 6, 15, cx - 3, 18], fill=INK)
        d.ellipse([cx + 3, 15, cx + 6, 18], fill=INK)
        arm = tilted_bar(cx + 14, 32, 16, 6, 60)
        d.polygon(arm, fill=TUNIC, outline=INK)
        sword = tilted_bar(cx + 20, 40, 26, 5, 80)
        d.polygon(sword, fill=BLADE, outline=INK, width=2)
    elif facing == "up":
        d.pieslice([cx - 12, 3, cx + 12, 24], 0, 360, fill=HAIR, outline=INK, width=2)
        d.polygon([(cx - 13, 24), (cx, 16), (cx + 13, 24), (cx + 10, 44), (cx - 10, 44)], fill=TUNIC_D)
        arm = tilted_bar(cx - 14, 32, 16, 6, 120)
        d.polygon(arm, fill=TUNIC, outline=INK)
        sword = tilted_bar(cx - 20, 22, 30, 5, 100)
        d.polygon(sword, fill=BLADE, outline=INK, width=2)
    elif facing == "left":
        d.pieslice([cx - 12, 3, cx + 12, 22], 200, 400, fill=HAIR, outline=INK, width=2)
        d.ellipse([cx - 9, 15, cx - 5, 18], fill=INK)
        arm = tilted_bar(cx - 12, 34, 14, 6, 180)
        d.polygon(arm, fill=TUNIC, outline=INK)
        sword = tilted_bar(cx - 24, 34, 30, 5, 180)
        d.polygon(sword, fill=BLADE, outline=INK, width=2)
        tip = tip_point(cx - 24, 34, 17, 180)
        d.polygon([tip, (tip[0]+6, tip[1]-4), (tip[0]+6, tip[1]+4)], fill=BLADE, outline=INK)
    else:  # right
        d.pieslice([cx - 12, 3, cx + 12, 22], 200, 400, fill=HAIR, outline=INK, width=2)
        d.ellipse([cx + 5, 15, cx + 9, 18], fill=INK)
        arm = tilted_bar(cx + 12, 34, 14, 6, 0)
        d.polygon(arm, fill=TUNIC, outline=INK)
        sword = tilted_bar(cx + 24, 34, 30, 5, 0)
        d.polygon(sword, fill=BLADE, outline=INK, width=2)
        tip = tip_point(cx + 24, 34, 17, 0)
        d.polygon([tip, (tip[0]-6, tip[1]-4), (tip[0]-6, tip[1]+4)], fill=BLADE, outline=INK)

    save(img, name)

# ---------------------------------------------------------------------------
# 敵
# ---------------------------------------------------------------------------
def draw_slime(name):
    img, d = canvas()
    d.ellipse([12, 46, 52, 56], fill=(0, 0, 0, 60))
    body = [10, 24, 54, 54]
    d.pieslice(body, 0, 360, fill=(86, 189, 108, 255))
    d.pieslice([16, 18, 48, 40], 180, 360, fill=(120, 214, 138, 255))
    d.rectangle([10, 40, 54, 54], fill=(86, 189, 108, 255))
    d.pieslice([10, 40, 54, 68], 180, 360, fill=(86, 189, 108, 255))
    outline(d, [(10, 46), (10, 30), (32, 16), (54, 30), (54, 46)], (46, 110, 60, 255), 3, closed=False)
    d.arc([10, 24, 54, 54], 180, 360, fill=(46, 110, 60, 255), width=3)
    d.ellipse([18, 24, 30, 34], fill=(255, 255, 255, 140))
    for ex in (24, 38):
        d.ellipse([ex - 3, 34, ex + 3, 40], fill=(20, 30, 20, 255))
        d.ellipse([ex - 1, 35, ex + 1, 37], fill=(255, 255, 255, 220))
    d.arc([22, 38, 40, 48], 10, 170, fill=(30, 50, 30, 255), width=2)
    save(img, name)

def draw_bat(name):
    img, d = canvas()
    purple = (108, 76, 150, 255)
    purple_d = (74, 50, 110, 255)
    d.polygon([(32, 22), (6, 10), (18, 30), (6, 34), (26, 40)], fill=purple, outline=INK, width=2)
    d.polygon([(32, 22), (58, 10), (46, 30), (58, 34), (38, 40)], fill=purple, outline=INK, width=2)
    d.polygon([(14, 14), (24, 24), (14, 24)], fill=purple_d)
    d.polygon([(50, 14), (40, 24), (50, 24)], fill=purple_d)
    d.ellipse([20, 20, 44, 42], fill=purple, outline=INK, width=3)
    d.polygon([(22, 20), (26, 12), (28, 21)], fill=purple, outline=INK, width=2)
    d.polygon([(42, 20), (38, 12), (36, 21)], fill=purple, outline=INK, width=2)
    for ex in (27, 37):
        d.ellipse([ex - 3, 27, ex + 3, 33], fill=(224, 70, 90, 255), outline=INK, width=1)
        d.ellipse([ex - 1, 29, ex + 1, 31], fill=(255, 220, 220, 255))
    d.polygon([(29, 36), (32, 40), (35, 36)], fill=(255, 255, 255, 230), outline=INK, width=1)
    save(img, name)

def draw_monster_box(name):
    img, d = canvas()
    wbase, wshadow, wlight = TIER["wood"]
    # 胴体
    d.rectangle([10, 30, 54, 54], fill=wbase, outline=INK, width=3)
    d.rectangle([10, 30, 20, 54], fill=wlight)
    d.rectangle([46, 30, 54, 54], fill=wshadow)
    for by in (38, 46):
        d.rectangle([10, by, 54, by + 4], fill=(90, 96, 102, 255), outline=INK, width=1)
    # 蓋（口を開けた顔になる）
    d.rounded_rectangle([9, 14, 55, 32], radius=7, fill=wbase, outline=INK, width=3)
    d.rounded_rectangle([9, 14, 21, 32], radius=7, fill=wlight)
    for tx in range(15, 50, 6):
        d.polygon([(tx, 29), (tx + 4, 29), (tx + 2, 35)], fill=(255, 255, 250, 255), outline=INK, width=1)
    for ex in (24, 40):
        d.ellipse([ex - 5, 18, ex + 5, 26], fill=(24, 22, 26, 255), outline=INK, width=2)
        d.ellipse([ex - 4, 17, ex + 1, 23], fill=(226, 70, 60, 255))
        d.ellipse([ex - 1, 19, ex + 1, 21], fill=(255, 235, 225, 255))
    save(img, name)

def draw_magic_book(name):
    img, d = canvas()
    cover = (94, 66, 156, 255)
    cover_d = (64, 44, 116, 255)
    page = (238, 228, 200, 255)
    for r, col in [(26, (150, 110, 230, 55)), (18, (150, 110, 230, 100))]:
        d.ellipse([32 - r, 30 - r, 32 + r, 30 + r], fill=col)
    d.polygon([(10, 24), (32, 20), (32, 50), (10, 46)], fill=cover, outline=INK, width=3)
    d.polygon([(14, 27), (29, 24), (29, 45), (14, 42)], fill=page)
    for ly in range(30, 44, 5):
        d.line([(16, ly), (27, ly - 1)], fill=(150, 140, 110, 255), width=1)
    d.polygon([(54, 24), (32, 20), (32, 50), (54, 46)], fill=cover_d, outline=INK, width=3)
    d.polygon([(50, 27), (35, 24), (35, 45), (50, 42)], fill=page)
    for ly in range(30, 44, 5):
        d.line([(48, ly), (37, ly - 1)], fill=(150, 140, 110, 255), width=1)
    d.line([(32, 19), (32, 51)], fill=(210, 190, 90, 255), width=2)
    d.polygon([(32, 4), (35, 10), (41, 11), (36, 15), (38, 21), (32, 17), (26, 21), (28, 15), (23, 11), (29, 10)],
              fill=(210, 180, 255, 230), outline=INK, width=1)
    save(img, name)

def draw_stone_statue(name):
    img, d = canvas()
    stone = (128, 130, 136, 255)
    stone_d = (86, 88, 94, 255)
    stone_l = (168, 170, 176, 255)
    d.ellipse([12, 56, 52, 62], fill=(0, 0, 0, 70))
    d.rectangle([16, 44, 26, 58], fill=stone_d, outline=INK, width=2)
    d.rectangle([38, 44, 48, 58], fill=stone_d, outline=INK, width=2)
    d.rounded_rectangle([12, 22, 52, 48], radius=4, fill=stone, outline=INK, width=3)
    d.rectangle([12, 22, 22, 48], fill=stone_l)
    d.rectangle([40, 22, 52, 48], fill=stone_d)
    d.rectangle([8, 16, 20, 30], fill=stone, outline=INK, width=3)
    d.rectangle([44, 16, 56, 30], fill=stone, outline=INK, width=3)
    d.rounded_rectangle([18, 4, 46, 26], radius=5, fill=stone, outline=INK, width=3)
    d.rectangle([18, 4, 26, 26], fill=stone_l)
    for ex in (27, 37):
        d.ellipse([ex - 4, 12, ex + 4, 18], fill=(226, 70, 60, 255), outline=INK, width=1)
        d.ellipse([ex - 1, 13, ex + 1, 15], fill=(255, 210, 200, 255))
    for (x1, y1, x2, y2) in [(20, 8, 24, 16), (34, 30, 30, 40), (44, 24, 48, 34)]:
        d.line([(x1, y1), (x2, y2)], fill=stone_d, width=2)
    mace_handle = tilted_bar(54, 42, 26, 5, -60)
    d.polygon(mace_handle, fill=(100, 70, 50, 255), outline=INK)
    d.ellipse([50, 8, 66, 24], fill=stone, outline=INK, width=3)
    d.ellipse([53, 11, 59, 17], fill=stone_l)
    save(img, name)

# ---------------------------------------------------------------------------
# 勇者 / 敵ヘルパー呼び出し
# ---------------------------------------------------------------------------
draw_hero("hero_down", "down")
draw_hero("hero_up", "up")
draw_hero("hero_left", "left")
draw_hero("hero_right", "right")

draw_slime("enemy_slime")
draw_bat("enemy_bat")
draw_monster_box("enemy_monster_box")
draw_magic_book("enemy_magic_book")
draw_stone_statue("enemy_stone_statue")

draw_shield("item_shield_wood", "wood")
draw_shield("item_shield_iron", "iron")
draw_shield("item_shield_bronze", "bronze")
draw_shield("item_shield_silver", "silver")
draw_shield("item_shield_gold", "gold", fancy=True)
draw_shield("item_shield_platinum", "platinum", fancy=True)

draw_club("item_weapon_club")
draw_hammer("item_weapon_iron_hammer")
draw_spear("item_weapon_bronze_spear")
draw_axe("item_weapon_silver_axe")
draw_sword("item_weapon_gold_sword", "gold")
draw_sword("item_weapon_platinum_greatsword", "platinum", big=True)

draw_fruit("item_fruit_hp", (108, 191, 92, 255), (70, 145, 62, 255), (170, 226, 140, 255))
draw_fruit("item_fruit_attack", (222, 82, 76, 255), (168, 48, 46, 255), (240, 140, 120, 255))
draw_fruit("item_fruit_defense", (78, 140, 214, 255), (48, 96, 160, 255), (140, 190, 240, 255))

draw_potion("item_heal_potion_s", 0.62, (224, 70, 96, 235))
draw_potion("item_heal_potion_m", 0.82, (224, 70, 96, 235))
draw_potion("item_heal_potion_l", 1.0, (224, 70, 96, 235))

# ---------------------------------------------------------------------------
# タイル / ギミック / 宝箱
# ---------------------------------------------------------------------------
STONE = (58, 50, 78, 255)
STONE_D = (42, 36, 58, 255)
STONE_L = (78, 68, 100, 255)

def draw_floor_base(d):
    d.rectangle([0, 0, S, S], fill=STONE)
    for gx in (0, 21, 42, 64):
        d.line([(gx, 0), (gx, S)], fill=STONE_D, width=2)
    for gy in (0, 21, 42, 64):
        d.line([(0, gy), (S, gy)], fill=STONE_D, width=2)
    for (x, y) in [(9, 9), (30, 50), (50, 14), (14, 45)]:
        d.ellipse([x, y, x + 3, y + 3], fill=STONE_L)

def draw_tile_floor(name):
    img, d = canvas()
    draw_floor_base(d)
    save(img, name)

def draw_tile_start(name):
    img, d = canvas()
    draw_floor_base(d)
    d.rounded_rectangle([8, 8, 56, 56], radius=8, fill=(52, 122, 78, 255), outline=(30, 82, 52, 255), width=3)
    d.rounded_rectangle([13, 13, 51, 51], radius=6, outline=(120, 200, 150, 255), width=2)
    d.polygon([(32, 20), (44, 36), (36, 36), (36, 46), (28, 46), (28, 36), (20, 36)],
              fill=(210, 240, 210, 255), outline=(30, 82, 52, 255), width=2)
    save(img, name)

def draw_tile_goal(name):
    img, d = canvas()
    d.rectangle([0, 0, S, S], fill=(46, 34, 16, 255))
    for r, col in [(30, (255, 214, 110, 60)), (22, (255, 214, 110, 110)), (14, (255, 230, 150, 200))]:
        d.ellipse([32 - r, 32 - r, 32 + r, 32 + r], fill=col)
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        x1, y1 = 32 + math.cos(a) * 16, 32 + math.sin(a) * 16
        x2, y2 = 32 + math.cos(a) * 27, 32 + math.sin(a) * 27
        d.line([(x1, y1), (x2, y2)], fill=(255, 224, 140, 200), width=2)
    d.polygon([(32, 20), (37, 29), (44, 32), (37, 35), (32, 44), (27, 35), (20, 32), (27, 29)],
               fill=(255, 244, 200, 255), outline=(150, 100, 20, 255), width=2)
    save(img, name)

def draw_tile_oneway(name):
    img, d = canvas()
    draw_floor_base(d)
    d.polygon([(16, 20), (16, 44), (36, 44), (36, 54), (52, 32), (36, 10), (36, 20)],
               fill=(95, 208, 199, 255), outline=(35, 110, 105, 255), width=3)
    d.polygon([(16, 20), (16, 44), (26, 44), (26, 20)], fill=(150, 232, 226, 255))
    save(img, name)

def draw_tile_switch(name):
    img, d = canvas()
    draw_floor_base(d)
    d.ellipse([13, 13, 51, 51], fill=(30, 60, 62, 255), outline=(16, 40, 42, 255), width=3)
    d.ellipse([18, 18, 46, 46], fill=(95, 208, 199, 255), outline=(35, 130, 122, 255), width=3)
    d.ellipse([23, 21, 37, 31], fill=(180, 240, 235, 255))
    save(img, name)

def draw_tile_door(name, open_):
    img, d = canvas()
    draw_floor_base(d)
    frame = (74, 58, 40, 255)
    d.rectangle([8, 4, 56, 60], fill=frame, outline=INK, width=3)
    if open_:
        d.rectangle([13, 9, 51, 55], fill=(20, 40, 40, 255))
        d.polygon([(13, 9), (30, 9), (24, 55), (13, 55)], fill=(70, 130, 100, 255), outline=INK, width=2)
        d.ellipse([25, 30, 29, 34], fill=(200, 230, 210, 255))
        for r, col in [(20, (110, 220, 210, 40)), (12, (110, 220, 210, 90))]:
            d.ellipse([32 - r, 32 - r, 32 + r, 32 + r], fill=col)
    else:
        wbase, wshadow, wlight = TIER["wood"]
        d.rectangle([13, 9, 51, 55], fill=wbase, outline=INK, width=2)
        d.rectangle([13, 9, 30, 55], fill=wlight)
        for by in (18, 30, 44):
            d.rectangle([13, by, 51, by + 4], fill=(96, 60, 34, 255))
        d.ellipse([39, 30, 45, 36], fill=(40, 30, 20, 255), outline=INK, width=1)
    save(img, name)

def draw_tile_damagefloor(name):
    img, d = canvas()
    draw_floor_base(d)
    for cx in (17, 32, 47):
        for cy in (20, 44):
            d.polygon([(cx, cy - 12), (cx + 7, cy + 8), (cx - 7, cy + 8)],
                      fill=(214, 74, 78, 255), outline=(120, 30, 34, 255), width=2)
            d.polygon([(cx, cy - 12), (cx + 3, cy - 2), (cx - 3, cy - 2)], fill=(250, 160, 150, 255))
    save(img, name)

def draw_chest(name, tier, size, opened=False):
    img, d = canvas()
    base, shadow, light = TIER[tier]
    scale = {"small": 0.72, "medium": 0.86, "large": 1.0}[size]
    w, h = 44 * scale, 26 * scale
    x0, y0 = 32 - w / 2, 50 - h
    x1, y1 = 32 + w / 2, 50
    d.ellipse([x0 + 2, y1 - 3, x1 - 2, y1 + 5], fill=(0, 0, 0, 60))
    d.rectangle([x0, y0, x1, y1], fill=(base if not opened else shadow), outline=INK, width=3)
    d.rectangle([x0, y0, x0 + w * 0.28, y1], fill=(light if not opened else base))
    band_y = y0 + (y1 - y0) * 0.62
    d.rectangle([x0, band_y, x1, band_y + 4], fill=shadow)
    d.rectangle([32 - 3, band_y - 2, 32 + 3, band_y + 8], fill=(80, 70, 40, 255), outline=INK, width=1)

    if opened:
        lid_h = h * 0.55
        d.polygon([(x0, y0), (x0 + 6, y0 - lid_h), (x1 - 6, y0 - lid_h), (x1, y0)],
                  fill=base, outline=INK, width=3)
        d.polygon([(x0, y0), (x0 + 6, y0 - lid_h), (32, y0 - lid_h)], fill=light)
        d.rectangle([x0 + 3, y0 - 2, x1 - 3, y0 + 4], fill=(20, 14, 10, 255))
        if size == "large":
            for gx, gy in [(24, y0 - lid_h + 6), (40, y0 - lid_h + 4)]:
                d.ellipse([gx - 3, gy - 3, gx + 3, gy + 3], fill=(120, 226, 216, 255), outline=INK, width=1)
    else:
        lid_h = h * 0.55
        d.rounded_rectangle([x0, y0 - lid_h, x1, y0 + 4], radius=6, fill=base, outline=INK, width=3)
        d.rectangle([x0, y0 - lid_h, x0 + w * 0.28, y0 + 4], fill=light)
        d.rectangle([x0, y0 - 2, x1, y0 + 4], fill=shadow)
        d.rounded_rectangle([32 - 6, y0 - 4, 32 + 6, y0 + 8], radius=3, fill=(90, 76, 40, 255), outline=INK, width=2)
        if size == "large":
            d.ellipse([32 - 4, y0 - 2, 32 + 4, y0 + 6], fill=TIER["platinum"][2], outline=INK, width=1)
    save(img, name)

draw_tile_floor("tile_floor")
draw_tile_start("tile_start")
draw_tile_goal("tile_goal")
draw_tile_oneway("tile_gimmick_oneway")
draw_tile_switch("tile_gimmick_switch")
draw_tile_door("tile_gimmick_door_closed", False)
draw_tile_door("tile_gimmick_door_open", True)
draw_tile_damagefloor("tile_gimmick_damagefloor")

draw_chest("tile_chest_small", "wood", "small")
draw_chest("tile_chest_medium", "iron", "medium")
draw_chest("tile_chest_large", "gold", "large")
draw_chest("tile_chest_opened", "wood", "medium", opened=True)

print("done:", len(os.listdir(OUT)), "files in", OUT)
