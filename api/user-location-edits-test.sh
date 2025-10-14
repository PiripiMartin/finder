# Test script for creating user location edits

# NOTE: You need to replace the following placeholders with actual data.
# - MAP_POINT_ID: The ID of the map point to edit.
# - AUTH_TOKEN: Your session token.
# - The JSON data in the curl command should be updated with the edits you want to make.

MAP_POINT_ID=1
AUTH_TOKEN="b62ecec6-4c5e-4cb6-afd2-2edf5ef015b5"

# This script assumes that the endpoint for editing a location is /api/map/edit/:id
# and that it accepts a POST request with a JSON body.
# This endpoint may need to be created in the API.

curl -X POST "localhost:8000/api/map/edit/${MAP_POINT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Title",
    "description": "New description for this location.",
    "emoji": "✨",
    "websiteUrl": "https://example.com",
    "phoneNumber": "1234567890",
    "address": "123 Main St, Anytown, USA"
  }'
