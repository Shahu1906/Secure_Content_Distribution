import { pool } from "../config/db.js";

/* ============================
   Get My Profile
============================ */
export const getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, email, name, role, roll_no,
              division, department, phone
       FROM users
       WHERE id=$1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });

  } catch (err) {
    console.error("Get Me Error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

/* ============================
   Update Profile
============================ */
export const updateProfile = async (req, res) => {
  const { phone, division, department } = req.body;

  try {
    await pool.query(
      `UPDATE users
       SET phone=$1,
           division=$2,
           department=$3
       WHERE id=$4`,
      [phone, division, department, req.user.id]
    );

    res.json({
      success: true,
      message: "Profile updated",
    });

  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ error: "Update failed" });
  }
};
