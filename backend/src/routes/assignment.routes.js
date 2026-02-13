import express from "express";

import {
  createAssignment,
  submitAssignment,
} from "../controllers/assignment.controller.js";

import { verifyToken } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.post("/create", verifyToken, createAssignment);

router.post(
  "/submit",
  verifyToken,
  upload.single("file"),
  submitAssignment
);

export default router;
