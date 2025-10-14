

MAP_POINT_ID=494
AUTH_TOKEN="b62ecec6-4c5e-4cb6-afd2-2edf5ef015b5"

curl "localhost:8000/api/map/saved" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

