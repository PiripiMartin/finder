#curl \
# -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" \
# -H "Accept-Language: en-US,en;q=0.9" \
# -H "Cookie: tt_webid=1234567890123456789; tt_webid_v2=1234567890123456789; region=US" \
# -H "Referer: https://www.tiktok.com/" \
# -L \
# "https://www.tiktok.com/@joviannet/photo/7537675292752596242" \
# > output.html


curl \
 -A "Mozilla/5.0" \
 "https://www.tiktok.com/api/item/detail/?itemId=7537675292752596242" \
 > output.html


