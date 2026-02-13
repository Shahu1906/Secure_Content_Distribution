import express from "express";

import {
  uploadMaterial,
  getMaterials,
} from "../controllers/material.controller.js";

import { verifyToken } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Teacher uploads notes
router.post(
  "/upload",
  verifyToken,
  upload.single("file"),
  uploadMaterial
);

// Get class materials
router.get(
  "/:classId",
  verifyToken,
  getMaterials
);

export default router;
