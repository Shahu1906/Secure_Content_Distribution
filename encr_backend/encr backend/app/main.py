from fastapi import FastAPI, UploadFile, File, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import secrets
import redis
import json
import shutil
import subprocess
import threading
import time
from dotenv import load_dotenv
from app.utils.crypto import encrypt_file, decrypt_file
from pdf2image import convert_from_path
from PIL import ImageDraw
import cloudinary
import cloudinary.uploader
import requests
from PIL import Image, ImageDraw, ImageFont



# ======================================================
# CONFIG
# ======================================================

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET")
if not INTERNAL_SECRET:
    raise RuntimeError("INTERNAL_SECRET not set")

r = redis.from_url(REDIS_URL, decode_responses=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


TEMP_PATH = os.path.join(BASE_DIR, "temp")
HLS_PATH = os.path.join(BASE_DIR, "hls_videos")

os.makedirs(TEMP_PATH, exist_ok=True)
os.makedirs(HLS_PATH, exist_ok=True)


TOKEN_EXPIRY = 300


POPPLER_PATH = (None)

# ======================================================
# APP INIT
# ======================================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================================================
# AUTH
# ======================================================

def verify_internal_key(x_internal_key: str = Header(None)):
    if x_internal_key != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid internal key")

# ======================================================
# CLEANUP
# ======================================================

def cleanup_folder(folder, delay=300):
    def delete():
        time.sleep(delay)
        if os.path.exists(folder):
            shutil.rmtree(folder, ignore_errors=True)

    t = threading.Thread(target=delete)
    t.daemon = True
    t.start()

# ======================================================
# ENCRYPT
# ======================================================

@app.post("/encrypt")
async def encrypt_endpoint(
    file: UploadFile = File(...),
    _=Depends(verify_internal_key)
):
    content = await file.read()
    encrypted_data, key, nonce = encrypt_file(content)
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")


    filename_without_ext, extension = os.path.splitext(file.filename)
    new_filename = f"{filename_without_ext}.edulock"
    upload_response = cloudinary.uploader.upload(
    encrypted_data,
    resource_type="raw",
    public_id=new_filename,
    type="private"
)


    file_url = upload_response["secure_url"]


    r.set(
    f"key:{new_filename}",
    json.dumps({
        "key": key.hex(),
        "nonce": nonce.hex(),
        "original_filename": file.filename,
        "extension": extension.lower(),
        "file_url": file_url
    })

)


    return {"stored_as": new_filename}

# ======================================================
# DECRYPT REQUEST
# ======================================================

@app.post("/decrypt/{filename}")
def decrypt_request(filename: str, _=Depends(verify_internal_key)):

    if not filename.endswith(".edulock"):
        filename += ".edulock"

    metadata_raw = r.get(f"key:{filename}")
    if not metadata_raw:
        raise HTTPException(status_code=404, detail="Metadata not found")

    metadata = json.loads(metadata_raw)

    # ✅ Check if file exists in Cloudinary
    file_url = metadata.get("file_url")
    if not file_url:
        raise HTTPException(status_code=404, detail="File URL missing")

    response = requests.head(file_url)

    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="Encrypted file does not exist in storage")

    # Generate token only if file exists
    token = secrets.token_urlsafe(32)

    r.setex(
        f"token:{token}",
        TOKEN_EXPIRY,
        json.dumps({
            "filename": filename,
        })
    )

    if metadata["extension"] == ".mp4":
        return {"type": "video", "playlist": f"/video/{token}/playlist.m3u8"}

    return {"type": "document", "pages": f"/document/{token}/pages"}


# ======================================================
# DOCUMENT PROCESSING
# ======================================================

@app.get("/document/{token}/pages")
def generate_document_pages(token: str):

    token_data = r.get(f"token:{token}")
    if not token_data:
        raise HTTPException(status_code=403, detail="Invalid token")

    token_data = json.loads(token_data)
    filename = token_data["filename"]

    metadata = json.loads(r.get(f"key:{filename}"))

    key = bytes.fromhex(metadata["key"])
    nonce = bytes.fromhex(metadata["nonce"])


    temp_folder = os.path.join(TEMP_PATH, token)
    os.makedirs(temp_folder, exist_ok=True)

    # Decrypt
    file_url = metadata["file_url"]

    response = requests.get(file_url)

    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="Encrypted file not found")

    encrypted_data = response.content


    decrypted_data = decrypt_file(encrypted_data, key, nonce)

    original_file_path = os.path.join(temp_folder, metadata["original_filename"])
    with open(original_file_path, "wb") as f:
        f.write(decrypted_data)

    extension = metadata["extension"]

    # Convert to PDF if needed
    if extension in [".ppt", ".pptx", ".doc", ".docx"]:
        subprocess.run(
    [
        "soffice",
        "--headless",
        "--convert-to", "pdf",
        original_file_path,
        "--outdir", temp_folder,
    ],
    check=True
)


        pdf_path = os.path.join(
            temp_folder,
            os.path.splitext(metadata["original_filename"])[0] + ".pdf"
        )
    else:
        pdf_path = original_file_path

    # Convert PDF to images
    pages = convert_from_path(pdf_path)


    image_urls = []

    for i, page in enumerate(pages):
        page = page.convert("RGBA")
        width, height = page.size
    
        # Create transparent layer same size as page
        watermark_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(watermark_layer)
    
        font_size = int(width / 8)
    
        try:
            font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()
    
        text = "EduLock"
    
        # Draw centered text
        draw.text(
            (width / 2, height / 2),
            text,
            font=font,
            fill=(0, 0, 0, 70),
            anchor="mm"
        )
    
        # Rotate with expand=True
        rotated = watermark_layer.rotate(45, expand=True)
    
        rw, rh = rotated.size
    
        # Calculate crop box to get original page size from center
        left = (rw - width) // 2
        top = (rh - height) // 2
        right = left + width
        bottom = top + height
    
        cropped = rotated.crop((left, top, right, bottom))
    
        # Merge
        page = Image.alpha_composite(page, cropped)
        page = page.convert("RGB")
    
        image_name = f"page_{i}.jpg"
        image_path = os.path.join(temp_folder, image_name)
        page.save(image_path, "JPEG")
    
        image_urls.append(f"/document/{token}/{image_name}")


        

    cleanup_folder(temp_folder, TOKEN_EXPIRY)

    return {"pages": image_urls}

@app.get("/document/{token}/{image_name}")
def serve_document_page(token: str, image_name: str):

    image_path = os.path.join(TEMP_PATH, token, image_name)

    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Page not found")

    return FileResponse(image_path, media_type="image/jpeg")


# ======================================================
# VIDEO PLAYLIST (Decrypt + HLS + Watermark)
# ======================================================

@app.get("/video/{token}/playlist.m3u8")
def serve_playlist(token: str):

    token_data_raw = r.get(f"token:{token}")
    if not token_data_raw:
        raise HTTPException(status_code=403, detail="Invalid or expired token")

    token_data = json.loads(token_data_raw)
    filename = token_data["filename"]


    video_id = filename.replace(".edulock", "")
    hls_folder = os.path.join(HLS_PATH, f"{video_id}_{token}")
    playlist_path = os.path.join(hls_folder, "playlist.m3u8")

    # If already generated
    if os.path.exists(playlist_path):
        return FileResponse(
            playlist_path,
            media_type="application/vnd.apple.mpegurl"
        )

    # ======================================================
    # STEP 1 — Decrypt video
    # ======================================================
    
    metadata_raw = r.get(f"key:{filename}")
    if not metadata_raw:
        raise HTTPException(status_code=404, detail="Metadata expired")
    
    metadata = json.loads(metadata_raw)
    
    key = bytes.fromhex(metadata["key"])
    nonce = bytes.fromhex(metadata["nonce"])
    
    file_url = metadata["file_url"]
    
    # 🔽 You forgot this line
    response = requests.get(file_url)
    
    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="Encrypted file not found")
    
    encrypted_data = response.content
    
    # 🔐 Decrypt video properly
    decrypted_data = decrypt_file(encrypted_data, key, nonce)
    
    temp_video_name = f"{video_id}_{token}.mp4"
    temp_video_path = os.path.join(TEMP_PATH, temp_video_name)
    
    with open(temp_video_path, "wb") as f:
        f.write(decrypted_data)



    # ======================================================
    # STEP 2 — Prepare folders
    # ======================================================

    os.makedirs(hls_folder, exist_ok=True)

    watermarked_video_name = f"{video_id}_{token}_wm.mp4"
    watermarked_video_path = os.path.join(TEMP_PATH, watermarked_video_name)

    watermark_filename = f"wm_{token}.txt"
    watermark_path = os.path.join(TEMP_PATH, watermark_filename)

    with open(watermark_path, "w", encoding="utf-8") as f:
        f.write("EduLock")

    # ======================================================
    # STEP 3 — Add Watermark (FIXED VERSION)
    # ======================================================

    ffmpeg_path = "ffmpeg"

    # Proper 4-space indentation inside the function
    result = subprocess.run(
        [
            ffmpeg_path,
            "-y",
            "-i", temp_video_name,  # input file
            "-vf",
            "drawtext="
            "fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:"
            "text='EduLock Secure':"
            "fontcolor=black@0.15:"
            "fontsize=24:"
            "x=(w-tw)/2 + 100*sin(t/20):"
            "y=(h-th)/2 + 50*cos(t/25)",  # ✅ comma added
            watermarked_video_name         # output file
        ],
        cwd=TEMP_PATH,
        capture_output=True,
        text=True
    )





    if result.returncode != 0:
        return {"ffmpeg_error": result.stderr}

 
    result = subprocess.run(
        [
            ffmpeg_path,
            "-y",
            "-i", watermarked_video_path,
            "-hls_time", "8",
            "-hls_playlist_type", "vod",
            "-hls_segment_filename",
            os.path.join(hls_folder, "segment_%03d.ts"),
            playlist_path
        ],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return {"hls_error": result.stderr}

    # Cleanup temp files
    for path in [temp_video_path, watermarked_video_path, watermark_path]:
        if os.path.exists(path):
            os.remove(path)


    cleanup_folder(hls_folder, TOKEN_EXPIRY)

    return FileResponse(
        playlist_path,
        media_type="application/vnd.apple.mpegurl"
    )


# ======================================================
# VIDEO SEGMENTS
# ======================================================

@app.get("/video/{token}/{segment}")
def serve_segment(token: str, segment: str):

    token_data_raw = r.get(f"token:{token}")
    if not token_data_raw:
        raise HTTPException(status_code=403, detail="Invalid or expired token")

    token_data = json.loads(token_data_raw)
    filename = token_data["filename"]

    video_id = filename.replace(".edulock", "")
    hls_folder = os.path.join(HLS_PATH, f"{video_id}_{token}")

    segment_path = os.path.join(hls_folder, segment)

    if not os.path.exists(segment_path):
        raise HTTPException(status_code=404, detail="Segment not found")

    return FileResponse(segment_path, media_type="video/MP2T")