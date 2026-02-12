from fastapi import FastAPI, UploadFile, File, Depends, Header, HTTPException
from fastapi.responses import FileResponse
import os
import time
from utils.crypto import encrypt_file, decrypt_file
from fastapi.responses import StreamingResponse
from io import BytesIO
import secrets
from fastapi_utils.tasks import repeat_every
import redis
import json
import mimetypes

r = redis.Redis(host='localhost', port=6380, decode_responses=False)


app = FastAPI()

# ===== INTERNAL SERVICE SECRET =====
INTERNAL_SECRET = "node_to_crypto_secret"


# ===== STORAGE PATH =====
STORAGE_PATH = "storage"

if not os.path.exists(STORAGE_PATH):
    os.makedirs(STORAGE_PATH)

# ===== TEMPORARY KEY STORE (In-memory) =====
key_store = {}

@app.on_event("startup")
def check_redis():
    try:
        r.ping()
    except redis.exceptions.ConnectionError:
        raise Exception("Redis is not running")


# ===== VERIFY INTERNAL SERVICE CALL =====
def verify_internal_key(x_internal_key: str = Header(None)):
    if x_internal_key != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


# ==========================
# HOME
# ==========================
@app.get("/")
def home():
    return {"message": "Crypto Microservice Running"}


# ==========================
# ENCRYPT ENDPOINT
# Called by Node.js
# ==========================
@app.post("/encrypt")
async def encrypt_endpoint(
    file: UploadFile = File(...),
    user_id: str = None,
    _=Depends(verify_internal_key)
):
    content = await file.read()

    encrypted_data, key, nonce = encrypt_file(content)

    filename = file.filename.split(".")[0]
    new_filename = f"{filename}.encr"
    file_path = os.path.join(STORAGE_PATH, new_filename)

    with open(file_path, "wb") as f:
        f.write(b"CIPHER_V1\n")
        f.write(encrypted_data)

    # Store key in Redis with TTL 10 minutes
    r.setex(
        f"key:{new_filename}",
        600,
        json.dumps({
            "key": key.hex(),
            "nonce": nonce.hex(),
            "user_id": user_id
        })
    )

    return {
        "message": "File encrypted and stored securely",
        "stored_as": new_filename
    }



# ==========================
# DECRYPT ENDPOINT
# Called by Node.js
# ==========================
@app.get("/stream/{token}")
def stream_file(token: str):

    filename = r.get(f"token:{token}")
    if not filename:
        raise HTTPException(status_code=403, detail="Invalid or expired token")

    data = r.get(f"key:{filename.decode()}")
    if not data:
        raise HTTPException(status_code=404, detail="Key expired")

    file_data = json.loads(data)

    key = bytes.fromhex(file_data["key"])
    nonce = bytes.fromhex(file_data["nonce"])

    file_path = os.path.join(STORAGE_PATH, filename.decode())

    with open(file_path, "rb") as f:
        f.readline()
        encrypted_data = f.read()

    decrypted_data = decrypt_file(encrypted_data, key, nonce)

    mime_type, _ = mimetypes.guess_type(filename.decode())
    if mime_type is None:
        mime_type = "application/octet-stream"


    # Delete token after one use
    r.delete(f"token:{token}")

    return StreamingResponse(
        BytesIO(decrypted_data),
         media_type=mime_type,
        headers={"Content-Disposition": "inline"}
    )



@app.post("/generate-token/{filename}")
def generate_token(
    filename: str,
    user_id: str,
    _=Depends(verify_internal_key)
):

    data = r.get(f"key:{filename}")
    if not data:
        raise HTTPException(status_code=404, detail="File not found")

    file_data = json.loads(data)

    if file_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    token = secrets.token_urlsafe(32)

    # Store token in Redis for 60 sec
    r.setex(f"token:{token}", 60, filename)

    return {"access_token": token}

    
