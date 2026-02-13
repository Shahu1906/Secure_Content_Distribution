import express from "express";
import { getMe, updateProfile } from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

/* Get My Profile */
router.get("/me", verifyToken, getMe);

/* Update Profile */
router.put("/update", verifyToken, updateProfile);

export default router;
