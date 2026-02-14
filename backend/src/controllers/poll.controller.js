import { pool } from "../config/db.js";

/* ============================
   Create Poll
============================ */
export const createPoll = async (req, res) => {
  const { classId, question, options } = req.body;
  const user = req.user;

  if (user.role !== "teacher") {
    return res.status(403).json({ error: "Only teachers" });
  }

  try {
    const poll = await pool.query(
      `INSERT INTO polls
       (class_id,question,created_by)
       VALUES($1,$2,$3)
       RETURNING id`,
      [classId, question, user.id]
    );

    const pollId = poll.rows[0].id;

    for (let opt of options) {
      await pool.query(
        `INSERT INTO poll_options
         (poll_id,option_text)
         VALUES($1,$2)`,
        [pollId, opt]
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create failed" });
  }
};

/* ============================
   Vote
============================ */
export const votePoll = async (req, res) => {
  const { pollId, optionId } = req.body;
  const user = req.user;

  try {
    await pool.query(
      `INSERT INTO poll_votes
       (poll_id,user_id,option_id)
       VALUES($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [pollId, user.id, optionId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Vote failed" });
  }
};

/* ============================
   Get Polls
============================ */
export const getPolls = async (req, res) => {
  const { classId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM polls WHERE class_id=$1`,
      [classId]
    );

    res.json({ success: true, polls: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
};
