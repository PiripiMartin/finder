
# Temporary test API calls

#VID_URL="https://www.tiktok.com/@takemeout_angel/video/7533369493456702727?is_from_webapp=1&sender_device=pc&web_id=7545686590786504210"
#VID_URL="https://vt.tiktok.com/ZSAG78yvV/"
VID_URL="https://www.tiktok.com/@gwensies/video/7535377857737002257"

AUTH_TOKEN="b62ecec6-4c5e-4cb6-afd2-2edf5ef015b5"


curl -X POST "localhost:8000/api/post" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "{\"url\": \"${VID_URL}\"}"
