import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;
const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors({
  origin: [
    "https://pascal-app.onrender.com" 
  ],
  credentials: true
}));

app.use(express.json());

/* ================= DATABASE ================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

// Real DB check
pool.query("SELECT 1")
  .then(() => console.log("✅ Database connected"))
  .catch(err => console.error("❌ Database error:", err.message));

/* ================= INIT DB ================= */

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        input TEXT,
        output TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Database initialized");
  } catch (err) {
    console.error("❌ DB init error:", err.message);
  }
};

initDB();

/* ================= ROUTES ================= */

// Home
app.get("/", (req, res) => {
  res.send("Pascal Backend Running 🚀");
});

/* ================= HISTORY ================= */

// Get all history
app.get("/api/history", async (req, res) => {
  try {
    const data = await pool.query(
      "SELECT * FROM history ORDER BY id DESC"
    );
    res.json(data.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one history item
app.get("/api/history/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const data = await pool.query(
      "SELECT * FROM history WHERE id = $1",
      [id]
    );

    res.json(data.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save history
app.post("/api/history", async (req, res) => {
  try {
    const { type, input, result } = req.body;

    const data = await pool.query(
      `INSERT INTO history (type, input, output)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [type, input, JSON.stringify(result)]
    );

    res.json(data.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear history
app.delete("/api/history", async (req, res) => {
  try {
    await pool.query("DELETE FROM history");
    res.json({ message: "History cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= PASCAL TRIANGLE ================= */

app.post("/api/pascal", (req, res) => {
  try {
    const num = parseInt(req.body.n);

    if (isNaN(num) || num < 0) {
      return res.status(400).json({ error: "Invalid n value" });
    }

    let rows = [];

    for (let i = 0; i <= num; i++) {
      let row = [];

      for (let j = 0; j <= i; j++) {
        if (j === 0 || j === i) {
          row.push(1);
        } else {
          row.push(rows[i - 1][j - 1] + rows[i - 1][j]);
        }
      }

      rows.push(row);
    }

    res.json({ rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= BINOMIAL EXPANSION ================= */

app.post("/api/expand", (req, res) => {
  try {
    const expression = req.body.expression;

    // Match: (something)^n
    const match = expression.match(/\((.+)\)\^(\d+)/);

    if (!match) {
      return res.status(400).json({
        error: "Invalid format. Use (ax^n + by^m)^p"
      });
    }

    const inside = match[1];
    const power = parseInt(match[2]);

    const parts = inside.split("+").map(s => s.trim());

    if (parts.length !== 2) {
      return res.status(400).json({
        error: "Only binomial expressions supported: (A + B)^n"
      });
    }

    // Parse term
    const parseTerm = (term) => {
      const m = term.match(/([0-9]*)?([a-zA-Z])(\^(\d+))?/);

      return {
        coeff: parseInt(m?.[1] || "1"),
        variable: m?.[2],
        power: parseInt(m?.[4] || "1")
      };
    };

    const A = parseTerm(parts[0]);
    const B = parseTerm(parts[1]);

    const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));

    const comb = (n, r) =>
      factorial(n) / (factorial(r) * factorial(n - r));

    let terms = [];

    for (let k = 0; k <= power; k++) {
      const coeff =
        comb(power, k) *
        Math.pow(A.coeff, power - k) *
        Math.pow(B.coeff, k);

      terms.push({
        coeff,
        varA: A.variable,
        powA: A.power * (power - k),
        varB: B.variable,
        powB: B.power * k,
        index: k
      });
    }

    res.json({
      expression,
      power,
      terms
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});