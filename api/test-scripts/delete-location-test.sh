
# Test script for per-user soft-deleting a location

# NOTE: Replace the placeholders below with your real values.
# - MAP_POINT_ID: The ID of the map point to delete for the user
# - AUTH_TOKEN: A valid session token

MAP_POINT_ID=465
AUTH_TOKEN="b62ecec6-4c5e-4cb6-afd2-2edf5ef015b5"

echo "=== BEFORE: Saved locations ==="
curl "localhost:8000/api/map/saved" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

echo
echo "\n=== BEFORE: Posts for location ${MAP_POINT_ID} ==="
curl "localhost:8000/api/map/${MAP_POINT_ID}/posts" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

echo
echo "\n=== DELETE: Soft-delete location ${MAP_POINT_ID} for current user ==="
curl -X DELETE "localhost:8000/api/map/${MAP_POINT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -i

echo
echo "\n=== AFTER: Saved locations (should no longer include ${MAP_POINT_ID}) ==="
curl "localhost:8000/api/map/saved" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

echo
echo "\n=== AFTER: Posts for location ${MAP_POINT_ID} (should be empty array) ==="
curl "localhost:8000/api/map/${MAP_POINT_ID}/posts" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

echo
# Optional: Uncomment and set coordinates to test saved+recommended endpoint filtering
# LAT=37.7749
# LON=-122.4194
# echo "\n=== AFTER: Saved + Recommended near ($LAT,$LON) ==="
# curl "localhost:8000/api/map/saved-and-recommended?lat=${LAT}&lon=${LON}" \
#   -H "Authorization: Bearer ${AUTH_TOKEN}"


