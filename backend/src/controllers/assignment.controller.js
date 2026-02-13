import { pool } from "../config/db.js";
import cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

/* ============================
   Create Assignment
============================ */
export const createAssignment = async (req, res) => {
  const { classId, title, description, deadline } = req.body;
  const user = req.user;

  if (user.role !== "teacher") {
    return res.status(403).json({ error: "Only teachers" });
  }

  try {
    await pool.query(
      `INSERT INTO assignments
       (class_id,title,description,deadline,created_by)
       VALUES($1,$2,$3,$4,$5)`,
      [classId, title, description, deadline, user.id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create failed" });
  }
};

/* ============================
   Submit Assignment
============================ */
export const submitAssignment = async (req, res) => {
  const { assignmentId } = req.body;
  const user = req.user;
  const file = req.file;

  try {
    const upload = await cloudinary.v2.uploader.upload(file.path);

    await pool.query(
      `INSERT INTO submissions
       (assignment_id,student_id,file_url)
       VALUES($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [assignmentId, user.id, upload.secure_url]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Submit failed" });
  }
};
