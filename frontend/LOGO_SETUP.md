# Platform Logo Setup Guide

## Overview
The PlatformBadge component now uses actual logos instead of emojis. The logos are stored in `public/logos/` directory.

## Logo Files Needed

Place the following logo files in `frontend/public/logos/`:

1. **amazon.png** - Amazon logo (official brand assets or favicon)
2. **flipkart.png** - Flipkart logo
3. **croma.png** - Croma logo
4. **reliance-digital.png** - Reliance Digital logo
5. **swiggy.png** - Swiggy logo
6. **zepto.png** - Zepto logo
7. **blinkit.png** - Blinkit logo
8. **bigbasket.png** - BigBasket logo

## Logo Specifications

- **Format**: PNG with transparent background (preferred)
- **Size**: 128x128px or larger (will be scaled to 16x16px in UI)
- **Aspect Ratio**: Square or the brand's official aspect ratio
- **File Size**: Keep under 50KB per logo

## How to Get Logos

### Option 1: Download from Official Sites (Recommended)
Visit each platform's website and save their favicon or logo:
- Amazon: https://www.amazon.in/favicon.ico
- Flipkart: https://www.flipkart.com/favicon.ico
- Swiggy: https://www.swiggy.com/favicon.ico
- etc.

### Option 2: Use Automated Script
```bash
cd frontend/public/logos

# Using curl to download favicons
curl -o amazon.png "https://www.amazon.in/favicon.ico"
curl -o flipkart.png "https://www.flipkart.com/favicon.ico"
curl -o croma.png "https://www.croma.com/favicon.ico"
curl -o reliance-digital.png "https://www.reliancedigital.in/favicon.ico"
curl -o swiggy.png "https://www.swiggy.com/favicon.ico"
curl -o zepto.png "https://www.zeptonow.com/favicon.ico"
curl -o blinkit.png "https://www.blinkit.com/favicon.ico"
curl -o bigbasket.png "https://www.bigbasket.com/favicon.ico"
```

### Option 3: Fallback CDN (Already Configured)
The component already has Clearbit Logo API as fallback:
- If local logos are not found, it will automatically fetch from `https://logo.clearbit.com/`
- This works automatically, no setup needed

## Current Fallback Behavior

1. **First**: Try to load from `/logos/[platform].png`
2. **Second**: If local file fails, load from Clearbit CDN
3. **Third**: If both fail, show generic 🏷️ icon

## Testing

After adding logos, test the display by:
1. Running the frontend: `npm run dev`
2. Navigate to deals page
3. Check if platform badges show actual logos instead of emojis

## Troubleshooting

### Logos Not Showing
- Check browser console for 404 errors
- Verify file names match exactly (case-sensitive)
- Ensure files are in `public/logos/` directory
- Try clearing browser cache

### Logos Look Blurry
- Use higher resolution source images (at least 128x128px)
- Ensure PNG format with transparency

### CORS Errors (for CDN logos)
- The Clearbit API should work without CORS issues
- If issues persist, download logos locally instead
