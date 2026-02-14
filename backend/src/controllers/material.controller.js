import { pool } from "../config/db.js";
import axios from "axios";
import crypto from "crypto";
import FormData from "form-data";
import fs from "fs";

/* =====================================================
   Helper: Encrypt file secret before storing in DB
===================================================== */
const encryptSecret = (secret) => {
  const masterKey = process.env.INTERNAL_SERVICE_KEY;

  const key = crypto
    .createHash("sha256")
    .update(masterKey)
    .digest();

  const iv = Buffer.alloc(16, 0);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");

  return encrypted;
};

/* =====================================================
   Helper: Decrypt file secret before sending to Python
===================================================== */
const decryptSecret = (encryptedSecret) => {
  const masterKey = process.env.INTERNAL_SERVICE_KEY;

  const key = crypto
    .createHash("sha256")
    .update(masterKey)
    .digest();

  const iv = Buffer.alloc(16, 0);

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encryptedSecret, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

/* =====================================================
   Upload Material (Teacher Only)
===================================================== */
export const uploadMaterial = async (req, res) => {
  const user = req.user;
  const { classId, title, description } = req.body;
  const file = req.file;

  if (user.role !== "teacher") {
    return res.status(403).json({ error: "Only teachers allowed" });
  }

  if (!file || !classId || !title) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Generate unique encryption secret
    const fileSecret = crypto.randomBytes(32).toString("hex");

    // Prepare multipart form-data for Python
    const formData = new FormData();
    formData.append("file", fs.createReadStream(file.path), {
    filename: file.originalname,
   });

    formData.append("secret", fileSecret);

    // Send file to Python encryption service
    const encRes = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/encrypt`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000,
      }
    );

    const storedAs = encRes.data.stored_as;

    if (!storedAs) {
      throw new Error("Python did not return stored_as");
    }

    // Encrypt secret before saving to DB
    const encryptedSecret = encryptSecret(fileSecret);

    await pool.query(
      `INSERT INTO materials
       (class_id, title, description, stored_as, encryption_key, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [classId, title, description, storedAs, encryptedSecret, user.id]
    );

    // Delete local file after encryption (important!)
    fs.unlink(file.path, (err) => {
      if (err) console.error("Local file delete failed:", err.message);
    });

    return res.status(201).json({
      success: true,
      message: "Material encrypted and stored securely",
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Material upload failed",
      details: err.response?.data || err.message,
    });
  }
};

/* =====================================================
   Get Materials (Metadata Only)
===================================================== */
export const getMaterials = async (req, res) => {
  const { classId } = req.params;
  const user = req.user;

  try {
    const member = await pool.query(
      `SELECT 1 FROM class_members
       WHERE class_id=$1 AND user_id=$2`,
      [classId, user.id]
    );

    if (!member.rows.length) {
      return res.status(403).json({ error: "Not a class member" });
    }

    const result = await pool.query(
      `SELECT id, title, description, created_at
       FROM materials
       WHERE class_id=$1
       ORDER BY created_at DESC`,
      [classId]
    );

    return res.json({
      success: true,
      materials: result.rows,
    });

  } catch (err) {
    console.error("FETCH ERROR:", err.message);
    return res.status(500).json({ error: "Fetch failed" });
  }
};

/* =====================================================
   View Material (Secure DRM Flow)
===================================================== */
export const viewMaterial = async (req, res) => {
  const materialId = req.params.id;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT stored_as, encryption_key, class_id
       FROM materials
       WHERE id=$1`,
      [materialId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Material not found" });
    }

    const { stored_as, encryption_key, class_id } = result.rows[0];

    // Verify class membership
    const member = await pool.query(
      `SELECT 1 FROM class_members
       WHERE class_id=$1 AND user_id=$2`,
      [class_id, userId]
    );

    if (!member.rows.length) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Decrypt secret before sending to Python
    const decryptedSecret = decryptSecret(encryption_key);

    // Ask Python to decrypt and create viewing session
    const decryptRes = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/decrypt/${stored_as}`,
      {
        filename: stored_as,
        secret: decryptedSecret,
      },
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
        },
        timeout: 60000,
      }
    );

    // Update last accessed time
    await pool.query(
      `UPDATE materials
       SET last_accessed = NOW()
       WHERE id=$1`,
      [materialId]
    );

    return res.json(decryptRes.data);

  } catch (err) {
    console.error("VIEW ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Material viewing failed",
      details: err.response?.data || err.message,
    });
  }
};
