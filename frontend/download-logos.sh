#!/bin/bash

# Platform Logo Download Script
# This script downloads logos for all supported platforms

LOGO_DIR="public/logos"
mkdir -p "$LOGO_DIR"

echo "📦 Downloading platform logos..."
echo ""

# Function to download and convert favicon to PNG
download_logo() {
    local name=$1
    local url=$2
    local output="$LOGO_DIR/$name.png"
    
    echo "Downloading $name logo..."
    
    # Try direct download
    if curl -L -s -f -o "$output" "$url"; then
        echo "✓ $name logo downloaded successfully"
    else
        echo "✗ Failed to download $name logo from $url"
        # Try Clearbit as fallback
        local domain=$(echo "$url" | sed -E 's|https?://([^/]+).*|\1|')
        local clearbit_url="https://logo.clearbit.com/$domain"
        echo "  Trying Clearbit fallback: $clearbit_url"
        if curl -L -s -f -o "$output" "$clearbit_url"; then
            echo "✓ $name logo downloaded from Clearbit"
        else
            echo "✗ Failed to download $name logo from fallback"
        fi
    fi
    echo ""
}

# Download all platform logos
download_logo "amazon" "https://www.amazon.in/favicon.ico"
download_logo "flipkart" "https://www.flipkart.com/favicon.ico"
download_logo "croma" "https://www.croma.com/favicon.ico"
download_logo "reliance-digital" "https://www.reliancedigital.in/favicon.ico"
download_logo "swiggy" "https://www.swiggy.com/favicon.ico"
download_logo "zepto" "https://www.zeptonow.com/favicon.ico"
download_logo "blinkit" "https://www.blinkit.com/favicon.ico"
download_logo "bigbasket" "https://www.bigbasket.com/favicon.ico"

echo "✨ Logo download complete!"
echo ""
echo "Logos saved to: $LOGO_DIR"
echo "Total files: $(ls -1 "$LOGO_DIR" | wc -l)"
echo ""

# List downloaded files
echo "Downloaded files:"
ls -lh "$LOGO_DIR"

echo ""
echo "Note: Some ICO files may need conversion to PNG for better compatibility."
echo "You can manually replace any logo with a higher quality version if needed."
