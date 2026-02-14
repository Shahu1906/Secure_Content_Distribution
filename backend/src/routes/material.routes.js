import express from "express";

import {
  uploadMaterial,
  getMaterials,
  viewMaterial   // 👈 add this
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
router.get("/test", (req, res) => {
  res.send("Route working");
});

// Get class materials
router.get(
  "/:classId",
  verifyToken,
  getMaterials
);

// 👇 ADD THIS ROUTE
router.get(
  "/view/:id",
  verifyToken,
  viewMaterial
);

export default router;
