
# Temporary test API calls

#################### FAILING LINKS (EMBED STAGE) ####################
#VID_URL="https://vt.tiktok.com/ZSULCJ4pr/"
#VID_URL="https://vt.tiktok.com/ZSUduGXs1/"
#VID_URL="https://vt.tiktok.com/ZSUdu6KuW/"

#################### FAILING LINKS (LOCATION RES) #################### 
#VID_URL="https://www.tiktok.com/@thechocs/video/7539826726755503380"

#################### SUCCEEDING LINKS ####################
VID_URL="https://vt.tiktok.com/ZSUdmTRsk/"
#VID_URL="https://www.tiktok.com/@bonjovinas/video/7547123801822219528"
#VID_URL="https://www.tiktok.com/@zsuperchika/video/7274104374664760578"
#VID_URL="https://www.tiktok.com/@nikolstach/video/7534470012606762258"
#VID_URL="https://www.tiktok.com/@bee.wac/video/7535366723378105607"

AUTH_TOKEN="b62ecec6-4c5e-4cb6-afd2-2edf5ef015b5"


curl -X POST "localhost:8000/api/post" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "{\"url\": \"${VID_URL}\"}"
