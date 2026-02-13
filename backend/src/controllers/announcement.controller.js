import { pool } from "../config/db.js";

/* ============================
   Create Announcement
============================ */
export const createAnnouncement = async (req, res) => {
  const { classId, message } = req.body;
  const user = req.user;

  if (user.role !== "teacher") {
    return res.status(403).json({
      error: "Only teachers can post announcements",
    });
  }

  if (!classId || !message) {
    return res.status(400).json({
      error: "Missing fields",
    });
  }

  try {
    await pool.query(
      `INSERT INTO announcements
       (class_id, message, created_by)
       VALUES ($1, $2, $3)`,
      [classId, message, user.id]
    );

    res.json({
      success: true,
      message: "Announcement posted",
    });

  } catch (err) {
    console.error("Create Announcement Error:", err);

    res.status(500).json({
      error: "Failed to create announcement",
    });
  }
};

/* ============================
   Get Announcements
============================ */
export const getAnnouncements = async (req, res) => {
  const { classId } = req.params;
  const user = req.user;

  try {
    // Optional: Check membership
    const member = await pool.query(
      `SELECT 1 FROM class_members
       WHERE class_id=$1 AND user_id=$2`,
      [classId, user.id]
    );

    if (!member.rows.length) {
      return res.status(403).json({
        error: "Not a class member",
      });
    }

    const result = await pool.query(
      `SELECT * FROM announcements
       WHERE class_id=$1
       ORDER BY created_at DESC`,
      [classId]
    );

    res.json({
      success: true,
      announcements: result.rows,
    });

  } catch (err) {
    console.error("Get Announcement Error:", err);

    res.status(500).json({
      error: "Failed to fetch announcements",
    });
  }
};
