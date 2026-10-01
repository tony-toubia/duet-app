# Image asset provenance register

All images below entered `main` in one commit (`bcdf81f`, 2026-04-11, the
first commit on main), so git records nothing about where they came from. The
December 2025 scaffold only had zero-byte placeholders. Fill in **Source** and
**Licence / rights** for each row, and keep receipts or licence files in a
private location (not this repo).

What the files themselves show:
- PNGs marked "Inkscape" carry an Inkscape export tag, so they were drawn or
  vectorized by someone, but that doesn't say who.
- Everything else has no embedded metadata:
  - no camera EXIF
  - no C2PA or AI-generator tags
  - no stock-agency or Adobe XMP data
- `hero-bg.jpg` has had its EXIF stripped, which is common for stock photos,
  so its source needs confirming.

| File | Size | Embedded metadata | Source | Licence / rights |
|---|---|---|---|---|
| assets/icon.png, assets/adaptive-icon.png | 1024×1024 | none | TO CONFIRM (Duet logo) | |
| assets/duet-logo.png, assets/duet-logo-padded.png, website/public/duet-logo.png, website/public/duet-logo-white.png | 348×325 / 648×725 | none | TO CONFIRM (Duet logo) | |
| assets/splash.png (= assets/duet-home-bg.png), website/public/duet-home-bg.png | 669×1280 | none | TO CONFIRM (background art) | |
| assets/duet-room-bg.png, website/public/duet-room-bg.png | 1024×1024 | none | TO CONFIRM (background art) | |
| website/public/hero-bg.jpg (= duet-app-bg.jpg) | JPEG | EXIF stripped | TO CONFIRM (photo?) | |
| website/public/og-image.png | 1200×630 | ICC profile only | TO CONFIRM | |
| website/public/always-on.png, private.png, stay-connected.png, working.png, exploring.png, on-the-road.png | 256–512 px | Inkscape | TO CONFIRM (feature icons) | |
| website/public/icons/*.png (admin icons) | 512×512 | Inkscape | TO CONFIRM | |
| website/public/mockup-lobby.png, mockup-room.png, mockup-share.png | 1320×2868 | none | Screenshots of Duet (own work) | Own |
| website/public/badge-appstore.png, badge-googleplay.png | 1200×335 | none | Apple / Google official badges | Apple and Google badge guidelines |
| assets/icons/spotify.png, youtube.png, youtube_music.png, apple_music.png, apple_maps.png, google_maps.png, waze.png | 128×128 | none | Third-party brand icons | Each brand's guidelines: use unaltered, only to link to the service |
| website/public/favicon.ico | ICO | none | TO CONFIRM (derived from logo?) | |
