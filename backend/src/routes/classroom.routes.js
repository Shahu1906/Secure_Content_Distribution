import express from "express";

import {
  createClass,
  joinClass,
  getMyClasses,
} from "../controllers/classroom.controller.js";

import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Protected Routes
router.post("/create", verifyToken, createClass);
router.post("/join", verifyToken, joinClass);
router.get("/my", verifyToken, getMyClasses);

export default router;
