# 🎓 EduLock - Secure Educational Content Distribution

EduLock is a next-generation **Secure Educational Content Distribution Platform** designed to allow teachers to securely share materials with students using advanced encryption and role-based access control.

This project features a modern **Next.js 16 (Turbopack)** frontend, a robust **Node.js/Express** backend with **PostgreSQL**, and a dedicated **Python Microservice (FastAPI)** for high-security AES-GCM file encryption.

---

## 🚀 Features

### 🔐 Security & Authentication
- **OTP-Based Authentication**: Secure login and registration using Email OTP (via Nodemailer & Redis).
- **Role-Based Access Control (RBAC)**: Distinct portals for **Teachers** and **Students**.
- **JWT-Based Sessions**: Stateless, secure authentication flow.

### 📚 Classroom Management (Teachers)
- **Create Classes**: Teachers can create classrooms and generate unique **Join Codes**.
- **Manage Students**: View and manage enrolled students.
- **Post Assignments**: create assignments with deadlines.
- **Real-time Polls**: Create and track polls for student engagement.
- **Announcements**: Broadcast messages to the entire class.

### 📂 Secure Content Distribution
- **Encrypted File Uploads**: All study materials are encrypted using **AES-GCM (256-bit)** before storage.
- **Python Encryption Service**: A dedicated microservice handles cryptographic operations.
- **Secure Streaming**: Files are decrypted on-the-fly and streamed to authorized students only.
- **Cloudinary Integration**: Encrypted blobs are stored securely in the cloud.

### 🎓 Student Features
- **Join Classes**: Join securely using a unique Class Code.
- **Access Materials**: View and download decrypted study materials.
- **Submit Assignments**: Upload assignment submissions.
- **Participate**: Vote in polls and view announcements.

---

## 🛠️ Tech Stack

### **Frontend** (`/edulock`)
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), Shadcn UI, Radix UI
- **Animations**: Framer Motion, GSAP
- **State Management**: React Hooks (Context API)
- **Networking**: Axios

### **Backend API** (`/Secure_Content_Distribution/backend`)
- **Runtime**: Node.js (Express.js)
- **Database**: PostgreSQL (via `pg` driver)
- **Caching & OTP**: Redis (Upstash/Local)
- **Storage**: Cloudinary
- **Authentication**: JWT, BCrypt, Nodemailer
- **Validation**: Joi (optional/partial)

### **Encryption Service** (`/Secure_Content_Distribution/encr_Backend`)
- **Framework**: Python FastAPI
- **Server**: Uvicorn
- **Cryptography**: `cryptography` (AES-GCM)
- **Communication**: REST API (Internal only)

---

## 🏗️ Architecture Overview

1.  **Client (Next.js)** sends a file upload request to **Node.js Backend**.
2.  **Node.js Backend** authenticates the user (Teacher).
3.  **Node.js Backend** forwards the file stream to **Python Encryption Service**.
4.  **Python Service** encrypts the file (AES-GCM) and returns the encrypted blob.
5.  **Node.js Backend** uploads the encrypted blob to **Cloudinary**.
6.  Metadata (file URL, key reference, IV) is stored in **PostgreSQL** and **Redis**.

---

## ⚡ Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.9+)
- **PostgreSQL** Database
- **Redis** Server (or Upstash URL)

### 1. Clone the Repository
```bash
git clone https://github.com/Sarthak-Jadhav-Dev/EduLock.git
cd EduLock
```

---

### 2. Backend Setup (Node.js)

Navigate to the backend directory:
```bash
cd Secure_Content_Distribution/backend
```

Install dependencies:
```bash
npm install
```

Configure Environment Variables (`.env`):
Create a `.env` file in `Secure_Content_Distribution/backend/` with the following:
```env
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
DB_SSL=true

# Redis (Upstash or Local)
REDIS_URL=rediss://default:password@host:6379

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=24h

# Cloudinary
CLOUD_NAME=your_cloud_name
CLOUD_API_KEY=your_api_key
CLOUD_API_SECRET=your_api_secret

# Email Service (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Python Service URL
PYTHON_SERVICE_URL=http://localhost:8000
```

Start the Backend Server:
```bash
npm run start
# OR for development
nodemon src/server.js
```

---

### 3. Encryption Service Setup (Python)

Open a **new terminal** and navigate to the encryption service:
```bash
cd Secure_Content_Distribution/encr_Backend
```

Create a virtual environment (recommended):
```bash
python -m venv venv
# Windows
.\venv\Scripts\activate
# Mac/Linux
source venv/bin/activate
```

Install Python Dependencies:
```bash
pip install -r requirements.txt
```
*(Note: If `requirements.txt` is missing, install: `pip install fastapi uvicorn redis python-multipart python-dotenv cryptography`)*

Configure Environment Variables (`.env`):
Create `.env` inside `encr_Backend/`:
```env
# Must match Backend's Redis URL
REDIS_URL=rediss://default:password@host:6379
```

Start the Python Microservice:
```bash
uvicorn main:app --reload --port 8000
```

---

### 4. Frontend Setup (Next.js)

Open a **third terminal** and navigate to the frontend:
```bash
cd edulock
```

Install dependencies:
```bash
npm install
```

Configure Environment Variables (`.env.local`):
Create `.env.local` in `edulock/`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

Start the Development Server:
```bash
npm run dev
```

Visit **http://localhost:3000** to use the application.

---

## 📚 API Overview

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/send-otp` | Send OTP to email | Public |
| **POST** | `/api/auth/verify-otp` | Verify OTP & Login/Register | Public |
| **POST** | `/api/class/create` | Create a new class | Teacher |
| **POST** | `/api/class/join` | Join a class using code | Student |
| **GET** | `/api/class/my` | Get my enrolled/created classes | Auth |
| **POST** | `/api/material/upload` | Upload & Encrypt Material | Teacher |
| **GET** | `/api/material/:classId` | Get class materials | Members |

---

## 🤝 Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
