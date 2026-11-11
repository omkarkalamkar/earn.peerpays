#!/bin/bash

echo "🚀 PeerPays - SSH Tunnel Setup"
echo "======================================"
echo ""
echo "This will create a secure tunnel to your Oracle Cloud server"
echo ""
echo "Keep this terminal OPEN while using the website"
echo ""
echo "Your website will be at: http://localhost:8080"
echo ""
echo "Starting tunnel now..."
echo ""

cd ~/Documents/Aniket_Booking

# Run SSH tunnel
ssh -i "ssh-key-2026-11-11 (1).key" -N -L 8080:localhost:80 ubuntu@129.154.238.134

