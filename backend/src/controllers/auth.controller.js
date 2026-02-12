import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import redis from "../config/redis.js";
import { pool } from "../config/db.js";
import { transporter } from "../services/mail.service.js";
import { generateOTP } from "../utils/otp.js";

/* =====================================================
   SEND OTP (For Login / Register)
===================================================== */
export const sendOTP = async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ error: "Email is required" });

  try {
    // Generate OTP
    const otp = generateOTP();
    const hash = await bcrypt.hash(otp, 10);

    // Store OTP in Redis (5 min expiry)
    await redis.set(`otp:${email}`, hash, {
      EX: 300,
    });

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "EduLock Login OTP",
      text: `Your OTP is ${otp}. Valid for 5 minutes.`,
    });

    res.json({
      success: true,
      message: "OTP sent to email",
    });

  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to send OTP",
    });
  }
};

/* =====================================================
   VERIFY OTP (AUTO LOGIN / REGISTER)
===================================================== */
export const verifyOTP = async (req, res) => {
  const {
    email,
    otp,

    // Optional (only for first-time users)
    name,
    phone,
    role,
    registrationId,
    rollNo,
    division,
    department,
  } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      error: "Email and OTP are required",
    });
  }

  try {
    /* ---------------------------------------
       1. Verify OTP from Redis
    --------------------------------------- */
    const savedHash = await redis.get(`otp:${email}`);

    if (!savedHash) {
      return res.status(400).json({
        success: false,
        error: "OTP expired or not found",
      });
    }

    const isValid = await bcrypt.compare(otp, savedHash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid OTP",
      });
    }

    // Delete OTP after success
    await redis.del(`otp:${email}`);

    /* ---------------------------------------
       2. Check if User Exists
    --------------------------------------- */
    let userResult = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    /* =======================================
       CASE A: EXISTING USER → LOGIN
    ======================================= */
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        success: true,
        mode: "login",
        token,
        user,
      });
    }

    /* =======================================
       CASE B: NEW USER → REGISTER
    ======================================= */

    // Validate required profile fields
    if (
      !name ||
      !phone ||
      !role ||
      !registrationId ||
      !division ||
      !department
    ) {
      return res.status(400).json({
        success: false,
        needProfile: true,
        error: "Profile details required for first-time login",
      });
    }

    // Insert new user
    const insertResult = await pool.query(
      `INSERT INTO users
        (name,email,phone,role,registration_id,
         roll_no,division,department)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        name,
        email,
        phone,
        role,
        registrationId,
        rollNo,
        division,
        department,
      ]
    );

    const newUser = insertResult.rows[0];

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      success: true,
      mode: "register",
      token,
      user: newUser,
    });

  } catch (err) {
    console.error("Verify OTP Error:", err);

    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
};
