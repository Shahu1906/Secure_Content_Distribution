import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

/* 🔴 THESE MUST BE BEFORE ROUTES */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());

/* Routes */
import authRoutes from "./routes/auth.routes.js";
import classRoutes from "./routes/classroom.routes.js";
import materialRoutes from "./routes/material.routes.js";
import announcementRoutes from "./routes/announcement.routes.js";
import userRoutes from "./routes/user.routes.js";
import assignmentRoutes from "./routes/assignment.routes.js";
import pollRoutes from "./routes/poll.routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/class", classRoutes);
app.use("/api/material", materialRoutes);
app.use("/api/announce", announcementRoutes);
app.use("/api/user", userRoutes);
app.use("/api/assignment", assignmentRoutes);
app.use("/api/poll", pollRoutes);

export default app;
