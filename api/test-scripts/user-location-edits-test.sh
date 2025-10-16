# Test script for creating user location edits

# NOTE: You need to replace the following placeholders with actual data.
# - MAP_POINT_ID: The ID of the map point to edit.
# - AUTH_TOKEN: Your session token.
# - The JSON data in the curl command should be updated with the edits you want to make.

MAP_POINT_ID=494
AUTH_TOKEN="b62ecec6-4c5e-4cb6-afd2-2edf5ef015b5"

# This script assumes that the endpoint for editing a location is /api/map/edit/:id
# and that it accepts a POST request with a JSON body.
# This endpoint may need to be created in the API.

curl -X POST "localhost:8000/api/map/edit/${MAP_POINT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bloomwood - Melbourne",
    "description": "Unique sweet & savoury pastries.",
    "emoji": "🥐",
    "address": "shop G01/121 Exhibition St, Melbourne VIC 3000"
  }'
