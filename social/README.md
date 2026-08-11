# Social presence

Eleven files. **None of them is in `MANIFEST.json`, and that is deliberate** — the manifest is the
record of what FLUX 2 Pro was asked to draw and what it cost, and nothing here was drawn. Every
file below is either a resample of an asset that *is* in the manifest, a composition of the
product's own logo, or a screenshot of the running estate. `verify.py` walks `assets/**/*.png` and
nothing else, so this directory is outside it by construction rather than by omission.

```
social/<org>/avatars|banners|screenshots/<use>-<width>x<height>.png
```

## avatars

| File | What it is |
| --- | --- |
| `avatar-128x128.png`, `-192`, `-256`, `-400`, `-512` | `assets/site/mark-1024x1024.png`, Lanczos-resampled |
| `github-org-500x500.png` | `assets/site/org-avatar-1024x1024.png`, Lanczos-resampled |

Provable, not asserted: resample the named source to the target size and the mean absolute
per-channel difference against the file here is **≤ 0.24 of 255** for the five avatars and **0.15**
for the GitHub one — the encoder's rounding, and nothing else. That is what makes them safe to
delete: they cost nothing to make again, and they cannot drift away from the mark without the mark
moving first.

The five sizes are the ones the platforms actually ask for: X wants 400, GitHub 500, Discord 128,
and 512 is the source the smaller ones would be cut from if a platform asked for something else.

## banners

| File | Where it goes |
| --- | --- |
| `x-header-1500x500.png` | X profile header |
| `linkedin-1128x191.png` | LinkedIn company page cover |
| `discord-960x540.png` | Discord server invite splash |

The **product** lockup — the flame-and-anvil mark with the CloudsForge wordmark, the same one the
sites render in their own headers — centred on `#12100f`. Not the FLUX mark: the sites do not put
generated art in their chrome, and a banner that disagreed with the header of the page it links to
would be worse than no banner.

`linkedin-1128x191.png` was rebuilt on 2026-08-11. The first cut scaled the lockup to fill the
width and **clipped the anvil off the bottom** — 1128×191 is a letterbox, and a lockup that is
nearly square does not survive being fitted to it. It is now laid out to fit the *height*, at 414×110
centred, which also keeps it clear of the company logo LinkedIn overlays on the lower left.

## screenshots

| File | What it shows |
| --- | --- |
| `genesis-1600x900.png` | The explorer's page for `ember/mainnet` block 0 |
| `genesis-stateroot-1600x900.png` | The same page, at the header table |

Captures of the live mainnet explorer, not mock-ups — the depth reads 13,193 because that is where
the chain stood when the shutter fell, and the genesis timestamp reads 15 Jun 2025 because that is
when EMBER started. They will age: a screenshot is a claim about a running system on a particular
day, and the day is in the pixels where nothing can update it. Re-take rather than retouch.

## Licence

Same as everything else here: code MIT, art CC BY 4.0. The two screenshots additionally show the
estate's own UI, which is the same company's work.
