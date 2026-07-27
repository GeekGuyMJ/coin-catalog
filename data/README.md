# Default Images

This file is bundled with the public Coin Catalog app and contains the default coin images that ship with the app.

## For Admins

1. **Work in your self-hosted version** (LXC 115)
2. **Mark images as Ready**: In Settings → Data → Package Default Images, click "Toggle Ready Mode" then click coin thumbnails to mark them as Ready
3. **Create Package**: Click "Create Defaults Package (JSON)" then "Download Package File"
4. **Deploy**: Copy the downloaded `coin-catalog-default-images.json` to this file

## Format

```json
{
  "version": 2,
  "created": "2026-01-01T00:00:00.000Z",
  "defaults": {
    "Lincoln Cent - Wheat": {
      "obv": "data:image/webp;base64,...",
      "rev": "data:image/webp;base64,..."
    },
    "State Quarter - Alabama": {
      "obv_image": "data:image/webp;base64,...",
      "rev_image": "data:image/webp;base64,..."
    }
  }
}
```

## Image Storage

- Images are stored as base64 WebP data URIs
- Maximum dimensions: 400x400px for coin images, 614x235px for paper currency
- Each image uses ~5-15KB as base64
