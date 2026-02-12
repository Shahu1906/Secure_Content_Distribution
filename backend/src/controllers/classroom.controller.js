import { pool } from "../config/db.js";
import { generateJoinCode } from "../utils/joincode.js";

/* ================================
   CREATE CLASS (Teacher Only)
================================ */
export const createClass = async (req, res) => {
  const { name, subject } = req.body;
  const user = req.user;

  if (user.role !== "teacher") {
    return res.status(403).json({
      error: "Only teachers can create classes",
    });
  }

  try {
    const joinCode = generateJoinCode();

    const result = await pool.query(
      `INSERT INTO classes
       (name, subject, teacher_id, join_code)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [name, subject, user.id, joinCode]
    );

    const newClass = result.rows[0];

    // Add teacher as member
    await pool.query(
      `INSERT INTO class_members
       (class_id, user_id, role)
       VALUES ($1,$2,'teacher')`,
      [newClass.id, user.id]
    );

    res.json({
      success: true,
      class: newClass,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Class creation failed",
    });
  }
};

/* ================================
   JOIN CLASS (Student)
================================ */
export const joinClass = async (req, res) => {
  const { joinCode } = req.body;
  const user = req.user;

  try {
    const classResult = await pool.query(
      "SELECT * FROM classes WHERE join_code=$1",
      [joinCode]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({
        error: "Invalid join code",
      });
    }

    const cls = classResult.rows[0];

    // Add student
    await pool.query(
      `INSERT INTO class_members
       (class_id, user_id, role)
       VALUES ($1,$2,'student')
       ON CONFLICT DO NOTHING`,
      [cls.id, user.id]
    );

    res.json({
      success: true,
      message: "Joined successfully",
      class: cls,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Join failed",
    });
  }
};

/* ================================
   GET MY CLASSES
================================ */
export const getMyClasses = async (req, res) => {
  const user = req.user;

  try {
    const result = await pool.query(
      `
      SELECT c.*
      FROM classes c
      JOIN class_members m
      ON c.id = m.class_id
      WHERE m.user_id = $1
      `,
      [user.id]
    );

    res.json({
      success: true,
      classes: result.rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch classes",
    });
  }
};
