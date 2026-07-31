#!/usr/bin/env python3
"""
Snap every generated asset's background to the brand ash ground.

FLUX will not reproduce an exact hex. Across the first full run the delivered
grounds ranged from #232324 to #3f3a3b against a target of #12100f — all too
light, several neutral grey rather than warm ash, and, worse, inconsistent with
each other, so the set did not read as one family. A mark placed on the app's
real background would show a visible lighter square.

Reprompting does not fix this reliably; it is a numeric property, so it is
corrected numerically. Pixels near the sampled ground are remapped to the exact
brand value, pixels belonging to the accent artwork are left alone, and the band
between them is blended so anti-aliased edges do not acquire a halo.

Pure standard library: no Pillow, so this runs anywhere the estate's CI runs.
"""

from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

TARGET = (0x12, 0x10, 0x0F)

# Below NEAR the pixel is ground and is snapped outright; above FAR it is artwork
# and is untouched. Between them it is blended, which is what keeps a 2px
# anti-aliased edge from turning into a visible ring.
NEAR = 46.0
FAR = 96.0


def _read(path: Path):
    data = path.read_bytes()
    pos, idat, width, height, colour = 8, b"", 0, 0, 2
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        if kind == b"IHDR":
            width, height, _depth, colour = struct.unpack(">IIBB", chunk[:10])
        elif kind == b"IDAT":
            idat += chunk
        pos += 12 + length
    channels = 4 if colour == 6 else 3
    raw = zlib.decompress(idat)
    stride = width * channels
    rows: list[bytearray] = []
    prev = bytearray(stride)
    i = 0
    for _ in range(height):
        filt = raw[i]
        i += 1
        line = bytearray(raw[i : i + stride])
        i += stride
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if filt == 1:
                line[x] = (line[x] + a) & 255
            elif filt == 2:
                line[x] = (line[x] + b) & 255
            elif filt == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 255
        rows.append(line)
        prev = line
    return width, height, channels, rows


def _write(path: Path, width: int, height: int, channels: int, rows) -> None:
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    colour = 6 if channels == 4 else 2

    def chunk(kind: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
        )

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, colour, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def _sample_ground(width, height, channels, rows) -> tuple[int, int, int]:
    """The modal border colour. The border is ground on every asset in the set."""
    counts: dict[tuple[int, int, int], int] = {}
    band = max(2, min(width, height) // 40)
    ys = list(range(band)) + list(range(height - band, height))
    for y in ys:
        line = rows[y]
        for x in range(0, width, 2):
            o = x * channels
            key = (line[o] // 8, line[o + 1] // 8, line[o + 2] // 8)
            counts[key] = counts.get(key, 0) + 1
    best = max(counts, key=counts.get)
    return (best[0] * 8 + 4, best[1] * 8 + 4, best[2] * 8 + 4)


def normalise(path: Path) -> tuple[tuple[int, int, int], int]:
    width, height, channels, rows = _read(path)
    ground = _sample_ground(width, height, channels, rows)
    changed = 0
    tr, tg, tb = TARGET
    gr, gg, gb = ground
    for y in range(height):
        line = rows[y]
        for x in range(width):
            o = x * channels
            r, g, b = line[o], line[o + 1], line[o + 2]
            dist = ((r - gr) ** 2 + (g - gg) ** 2 + (b - gb) ** 2) ** 0.5
            if dist >= FAR:
                continue
            if dist <= NEAR:
                w = 1.0
            else:
                w = (FAR - dist) / (FAR - NEAR)
            line[o] = int(round(r + (tr - r) * w))
            line[o + 1] = int(round(g + (tg - g) * w))
            line[o + 2] = int(round(b + (tb - b) * w))
            changed += 1
    _write(path, width, height, channels, rows)
    return ground, changed


def refresh_manifest(paths: list[Path]) -> int:
    """Re-record the checksum of every file this script rewrote.

    THE BUG THIS FIXES. `generate.ts` writes MANIFEST.json at generation time, and this script
    then rewrites the pixels — so every checksum in the manifest described the image as FLUX
    delivered it, not the image that is committed. `verify.py` compares against the manifest and
    reported "checksum does not match" for 29 of the 73 committed assets: the verifier failed on
    its own repository, and had presumably always done so.

    A verifier that is red on correct input is one people stop reading, which is the same failure
    the estate has now hit in a CI guard that fired on its own comment, a rule that rejected every
    service it protected, and a reproduce line pointing at a script that never existed. So the
    ordering is fixed at the source rather than by hand-patching the numbers: whatever this script
    rewrites, it re-records.
    """
    import hashlib, json

    manifest = Path("MANIFEST.json")
    if not manifest.exists():
        return 0
    document = json.loads(manifest.read_text())
    entries = document.get("assets") or []
    by_path = {str(p): p for p in paths}
    changed = 0
    for entry in entries:
        target = by_path.get(entry.get("path", ""))
        if target is None or not target.exists():
            continue
        data = target.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if entry.get("sha256") != digest or entry.get("byteSize") != len(data):
            entry["sha256"] = digest
            entry["byteSize"] = len(data)
            changed += 1
    if changed:
        manifest.write_text(json.dumps(document, indent=2) + "\n")
    return changed


if __name__ == "__main__":
    targets = sorted(Path("assets").rglob("*.png"))
    if not targets:
        print("no assets found", file=sys.stderr)
        raise SystemExit(1)
    for p in targets:
        was, n = normalise(p)
        print(f"{p}  was #{was[0]:02x}{was[1]:02x}{was[2]:02x}  remapped {n} px")
    updated = refresh_manifest(targets)
    print(f"manifest: {updated} checksum(s) re-recorded after normalisation")
