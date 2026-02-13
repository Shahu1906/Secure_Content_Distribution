import { pool } from "../config/db.js";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import cloudinary from "cloudinary";

/* ============================
   Cloudinary Config
============================ */
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

/* ============================
   Upload Material
============================ */
export const uploadMaterial = async (req, res) => {
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

  const user = req.user;
  const { classId, title, description } = req.body;
  const file = req.file;

  if (user.role !== "teacher") {
    return res.status(403).json({ error: "Only teachers allowed" });
  }

  if (!file || !classId || !title) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    /* Send to Python Encrypt */
    const form = new FormData();
    form.append("file", fs.createReadStream(file.path));

    const encRes = await axios.post(
      process.env.PYTHON_SERVICE_URL + "/encrypt",
      form,
      { headers: form.getHeaders() }
    );

    const encFile = encRes.data.file;

    /* Upload to Cloudinary */
    const uploadRes = await cloudinary.v2.uploader.upload(
      "uploads/encrypted/" + encFile,
      { resource_type: "auto" }
    );

    /* Save DB */
    await pool.query(
      `INSERT INTO materials
      (class_id,title,description,file_url,file_type,uploaded_by)
      VALUES($1,$2,$3,$4,$5,$6)`,
      [
        classId,
        title,
        description,
        uploadRes.secure_url,
        file.mimetype,
        user.id,
      ]
    );

    res.json({
      success: true,
      message: "Material uploaded",
    });

  } catch (err) {
    console.error("Material Upload Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
};

/* ============================
   Get Materials
============================ */
export const getMaterials = async (req, res) => {
  const { classId } = req.params;
  const user = req.user;

  try {
    /* Check membership */
    const member = await pool.query(
      `SELECT 1 FROM class_members
       WHERE class_id=$1 AND user_id=$2`,
      [classId, user.id]
    );

    if (!member.rows.length) {
      return res.status(403).json({ error: "Not a class member" });
    }

    const result = await pool.query(
      `SELECT * FROM materials
       WHERE class_id=$1
       ORDER BY created_at DESC`,
      [classId]
    );

    res.json({
      success: true,
      materials: result.rows,
    });

  } catch (err) {
    console.error("Get Materials Error:", err);
    res.status(500).json({ error: "Fetch failed" });
  }
};
