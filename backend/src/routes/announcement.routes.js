import express from "express";

import {
  createAnnouncement,
  getAnnouncements,
} from "../controllers/announcement.controller.js";

import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/create", verifyToken, createAnnouncement);
router.get("/:classId", verifyToken, getAnnouncements);

export default router;
