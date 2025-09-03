
# Temporary test API calls

#VID_URL="https://www.tiktok.com/@takemeout_angel/video/7533369493456702727?is_from_webapp=1&sender_device=pc&web_id=7545686590786504210"
VID_URL="https://vt.tiktok.com/ZSAG78yvV/"


curl -X POST "localhost:8000/api/post" \
  -H "Authorization: Bearer 9bdd72fd-3d6d-4760-bef9-ea6fa3020ff5" \
  -d "{\"url\": \"${VID_URL}\"}"
