import urllib.request, urllib.parse, json

login = urllib.request.urlopen(
    urllib.request.Request('http://127.0.0.1:8000/api/auth/login',
        urllib.parse.urlencode({'username':'admin@crm.ru','password':'admin123'}).encode()),
    timeout=5)
token = json.loads(login.read())['access_token']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# GET /api/clients (no trailing slash)
r = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8000/api/clients', headers=headers), timeout=5)
print('GET clients:', r.status)

# POST a client
body = json.dumps({'name': 'ТестОрг', 'inn': '1234567890'}).encode()
r2 = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8000/api/clients', data=body, headers=headers, method='POST'), timeout=5)
cl = json.loads(r2.read())
print('POST client:', r2.status, cl)

# DELETE it
cid = cl['id']
r3 = urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:8000/api/clients/{cid}', headers=headers, method='DELETE'), timeout=5)
print('DELETE client:', r3.status, r3.read().decode())
