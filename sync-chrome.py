#!/usr/bin/env python3
"""Push a chosen set's browser chrome out to the repositories that carry copies of it.

    python3 sync-chrome.py --dry-run                 # what would change, and where
    python3 sync-chrome.py                           # the shipped set, everywhere
    python3 sync-chrome.py --provider gpt-image-2    # a candidate, without promoting it
    python3 sync-chrome.py --only network-site,site  # two repositories

═══════════════════════════════════════════════════════════════════════════════════════════════
## WHY THIS EXISTS

`materialise.py` already resolves one set into one destination, and its own header states the
seam it was written for: nothing in the estate reads this repository at run time, every consumer
holds a COMMITTED COPY in its own `public/`, and the copy is baked into an nginx image. What it
does not carry is WHICH repository takes WHICH surface, so the last step of a promotion was
nineteen invocations somebody had to know to make. That knowledge lived in nineteen test files
and in nobody's head, which is the same condition `materialise.py` describes as "manual,
unrecorded and undated" — solved one layer down and left unsolved at the layer that runs.

So the map is here, once, with the reason for each row that is not obvious.

## IT REPLACES, IT DOES NOT POPULATE

Each consumer decides for itself which chrome it ships: `site` carries four files, `admin-web`
three, `tessera-web` five including an `apple-touch-icon` this repository does not define. This
walks what a repository ALREADY HAS and swaps the bytes for the chosen set's; it never adds a
file. Adding one would be a decision about that repository's `index.html`, which is that
repository's to make — and an unlinked PNG in `public/` is dead weight baked into an image.

A file the consumer carries that the surface does not define is REPORTED rather than skipped
silently. Three of them are real and each is somebody's open decision:

  - `tessera-web/public/apple-touch-icon-180x180.png` — a size this repository has never
    generated for any surface.
  - `mint-web/public/mark-256.png`, `foresight-web/public/mark-256.png` — a 256px mark, where
    every surface here defines `mark-1024x1024.png` and no 256 derivative.

## WHAT IT WILL FIND THE FIRST TIME IT IS RUN

Five consumers are ALREADY out of step with the shipped set, by a few bytes each — `site`,
`hub-web`, `status-web`, `foresight-web`, `web-template`. Same pictures, different encodings: the
copies were taken before a re-derive and nothing has compared them since, because only three of
the nineteen tests byte-compare at all (`network-site`, `pool-web`, `exchange-web`). That drift
is the defect this file closes, and it is why the first run is not a no-op.
"""

from __future__ import annotations

import argparse
import filecmp
import shutil
import sys
from pathlib import Path

import providers

HERE = Path(__file__).resolve().parent
SIBLINGS = HERE.parent

#: repository -> (surface, why this surface), for every consumer that carries a copy.
#:
#: The three rows whose surface is not their own name are the whole reason this is a table and not
#: a `for` loop over directory names.
CONSUMERS: dict[str, tuple[str, str]] = {
    "admin-web": ("admin", ""),
    "beacon-web": ("beacon", ""),
    "devportal-web": ("developers", "the surface is `developers`; the repository is named for the portal"),
    "exchange-web": ("site", "there is no `exchange` surface yet — its own test asserts that absence"),
    "explorer-web": ("explorer", ""),
    "foresight-web": ("foresight", ""),
    "hub-web": ("hub", ""),
    "lantern-web": ("lantern", ""),
    "market-web": ("market", ""),
    "mint-web": ("create", "the product is Forge Create; the service behind it is mint"),
    "network-site": ("network", ""),
    "pool-web": ("network", "there is no `pool` surface yet — the pool is part of Forge Network"),
    "site": ("site", ""),
    "status-web": ("status", ""),
    "trade-web": ("trade", ""),
    "web-template": ("site", "a frontend cut from the template starts life wearing the main site's chrome"),
    "worlds-web": ("worlds", ""),
}

#: Consumers that carry chrome and are deliberately NOT in the table above. Listed so that a
#: reader counting `public/favicon-32x32.png` across the estate finds the missing three answered
#: here rather than assumed to be an oversight.
NOT_OURS = {
    "emberkin-web": "its chrome is micro-emberkin-assets/assets/title/, not this repository's",
    "aetherholm-web": "its chrome is micro-aetherholm-assets/assets/title/",
    "tessera-web": "its chrome is micro-tessera-assets/assets/chrome/",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    providers.add_argument(parser)
    parser.add_argument("--only", default=None, help="comma-separated repository names")
    parser.add_argument("--dry-run", action="store_true", help="report; write nothing")
    args = parser.parse_args()

    chosen = providers.by_id(args.provider) if args.provider else providers.reference()
    only = {name.strip() for name in args.only.split(",")} if args.only else None
    if only:
        unknown = sorted(only - set(CONSUMERS))
        if unknown:
            print(f"FAIL: not consumers of this repository: {', '.join(unknown)}", file=sys.stderr)
            for name in unknown:
                if name in NOT_OURS:
                    print(f"      {name}: {NOT_OURS[name]}", file=sys.stderr)
            return 2

    print(f"chrome from `{chosen.id}` at {chosen.root.relative_to(HERE.parent)}\n")
    changed = missing = unmatched = 0

    for repo, (surface, why) in CONSUMERS.items():
        if only and repo not in only:
            continue
        public = SIBLINGS / repo / "public"
        source = chosen.root / "assets" / surface
        if not public.is_dir():
            print(f"  {repo:14s} SKIP  not checked out")
            continue
        if not source.is_dir():
            print(f"  {repo:14s} FAIL  `{chosen.id}` has no {surface}/ — it cannot dress this surface")
            missing += 1
            continue

        took, same, orphans = [], 0, []
        for file in sorted(public.glob("*.png")):
            candidate = source / file.name
            if not candidate.exists():
                orphans.append(file.name)
                continue
            if filecmp.cmp(file, candidate, shallow=False):
                same += 1
                continue
            if not args.dry_run:
                shutil.copyfile(candidate, file)
            took.append(file.name)

        changed += len(took)
        unmatched += len(orphans)
        note = f"  ({why})" if why else ""
        verb = "would take" if args.dry_run else "took"
        head = f"  {repo:14s} <- {surface:11s}"
        if took:
            print(f"{head} {verb} {len(took)}, {same} already current{note}")
            for name in took:
                print(f"                     {name}")
        else:
            print(f"{head} current ({same} file(s)){note}")
        for name in orphans:
            print(f"                     {name} — not defined for this surface, left alone")

    print(f"\n  {changed} file(s) {'would be ' if args.dry_run else ''}replaced, "
          f"{unmatched} carried by a consumer and not defined here, {missing} surface(s) absent.")
    if missing:
        print("  A set that cannot dress every surface must not be promoted; see verify.py.")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
