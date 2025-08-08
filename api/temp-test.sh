
# Temporary test API call before proper login page is implemented

curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "test"}'

