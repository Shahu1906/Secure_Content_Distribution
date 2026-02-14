# =========================
# Base image
# =========================
FROM python:3.12-slim

# =========================
# Set working directory
# =========================
WORKDIR /app

# =========================
# Install system dependencies
# =========================
RUN apt-get update && apt-get install -y \
    ffmpeg \
    poppler-utils \
    libreoffice \
    fonts-dejavu \
    build-essential \
    wget \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# =========================
# Upgrade pip
# =========================
RUN pip install --upgrade pip

# =========================
# Copy Python dependencies file
# =========================
COPY requirements.txt .

# =========================
# Install Python dependencies
# =========================
RUN pip install --no-cache-dir -r requirements.txt

# =========================
# Copy the app code
# =========================
COPY app/ ./app
COPY .env ./

# =========================
# Create temp folders
# =========================
RUN mkdir -p ./temp ./hls_videos ./storage

# =========================
# Set environment variables (optional)
# =========================
ENV PYTHONUNBUFFERED=1
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# =========================
# Expose Hugging Face default port
# =========================
EXPOSE 7860

# =========================
# Run FastAPI app with uvicorn
# =========================
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--reload"]
