#!/bin/bash
# Script to add environment variables to Vercel
# Run this after installing Vercel CLI: npm i -g vercel

echo "Adding environment variables to Vercel..."

vercel env add REACT_APP_SUPABASE_URL production <<< "https://gwubzauelilziaqnsfac.supabase.co"
vercel env add REACT_APP_SUPABASE_URL preview <<< "https://gwubzauelilziaqnsfac.supabase.co"

vercel env add REACT_APP_SUPABASE_ANON_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dWJ6YXVlbGlsemlhcW5zZmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NDI0MDMsImV4cCI6MjA2ODAxODQwM30.LkDhWPcJBIJThPPQ-YEmMi_3tl7GMp0lvDoawXehLho"
vercel env add REACT_APP_SUPABASE_ANON_KEY preview <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dWJ6YXVlbGlsemlhcW5zZmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NDI0MDMsImV4cCI6MjA2ODAxODQwM30.LkDhWPcJBIJThPPQ-YEmMi_3tl7GMp0lvDoawXehLho"

vercel env add REACT_APP_UNSPLASH_ACCESS_KEY production <<< "zyA74qKSAGOPf2LOsdY7TLvO3d-YfOs3XXPfPinia-A"
vercel env add REACT_APP_UNSPLASH_ACCESS_KEY preview <<< "zyA74qKSAGOPf2LOsdY7TLvO3d-YfOs3XXPfPinia-A"

echo "Done! Now redeploy your project with: vercel --prod"
