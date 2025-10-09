
# Temporary test API calls

#################### FAILING LINKS ####################
#VID_URL="https://vt.tiktok.com/ZSULCJ4pr/"
#VID_URL="https://vt.tiktok.com/ZSUduGXs1/"

#################### SUCCEEDING LINKS ####################
VID_URL="https://vt.tiktok.com/ZSUdmTRsk/"

AUTH_TOKEN="b62ecec6-4c5e-4cb6-afd2-2edf5ef015b5"


curl -X POST "localhost:8000/api/post" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "{\"url\": \"${VID_URL}\"}"
