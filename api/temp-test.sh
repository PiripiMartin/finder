
# Temporary test API call before proper login page is implemented

#curl -X POST http://localhost:8000/api/login \
#  -H "Content-Type: application/json" \
#  -d '{"username": "admin", "password": "test"}'

curl -X POST http://localhost:8000/api/validate-token \
  -H "Content-Type: application/json" \
  -d '{"userId": 2, "sessionToken": "396c92fd-f224-470e-ac38-a2f352104c58"}'
