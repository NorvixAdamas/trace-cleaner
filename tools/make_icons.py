"""Sinh icon extension (16/32/48/128 px) bằng stdlib: nền tối bo góc + chữ T màu teal."""
import struct
import zlib
from pathlib import Path

BG = (11, 18, 32, 255)        # #0b1220
FG = (94, 234, 212, 255)      # #5eead4


def png(path: Path, size: int) -> None:
    px = bytearray()
    r = size * 0.22          # bán kính bo góc
    bar_w = size * 0.13      # độ dày nét chữ T
    top = size * 0.24
    bottom = size * 0.76
    left = size * 0.22
    right = size * 0.78

    for y in range(size):
        px.append(0)  # filter type 0
        for x in range(size):
            # bo góc
            inside = True
            for cx, cy in ((r, r), (size - r, r), (r, size - r), (size - r, size - r)):
                if (x < r and y < r and (cx, cy) == (r, r)) or \
                   (x > size - r and y < r and (cx, cy) == (size - r, r)) or \
                   (x < r and y > size - r and (cx, cy) == (r, size - r)) or \
                   (x > size - r and y > size - r and (cx, cy) == (size - r, size - r)):
                    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                        inside = False
            if not inside:
                px.extend((0, 0, 0, 0))
                continue
            # chữ T: thanh ngang + thanh dọc
            stem = abs(x - size / 2) <= bar_w / 2 and top <= y <= bottom
            bar = top <= y <= top + bar_w and left <= x <= right
            px.extend(FG if (stem or bar) else BG)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    raw = bytes(px)
    out = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path.write_bytes(out)


if __name__ == "__main__":
    d = Path(__file__).resolve().parent.parent / "extension" / "icons"
    d.mkdir(parents=True, exist_ok=True)
    for s in (16, 32, 48, 128):
        png(d / f"icon{s}.png", s)
        print("wrote", d / f"icon{s}.png")
