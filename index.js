require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const client = require("./config/db");

const app = express();
const port = process.env.PORT || 5000;
const fallbackOrigins = [
  "http://localhost:3000",
  "https://classy-mousse-8b9f13.netlify.app",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://e-cormmerce-server.vercel.app",
];

const envOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_2,
  process.env.CLIENT_URL_3,
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((item) => item.trim()),
].filter(Boolean);

const allowedOrigins = [
  ...new Set([...envOrigins, ...fallbackOrigins]),
];

app.set("trust proxy", 1);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools like cURL/Postman (no origin header).
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.error(`CORS blocked for origin: ${origin}`);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

/* =====================
   MIDDLEWARE
===================== */
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* =====================
   ROUTES (ALL)
===================== */
app.use(require("./routes/auth.routes"));
app.use(require("./routes/otp.routes"));
app.use(require("./routes/user.routes"));
app.use(require("./routes/product.routes"));
app.use(require("./routes/cart.routes"));
app.use(require("./routes/wishlist.routes"));
app.use(require("./routes/order.routes"));
app.use(require("./routes/payment.routes"));

/* =====================
   ROOT
===================== */
app.get("/", (req, res) => {
  res.send("FastDokan API is running");
});

app.get("/health", (req, res) => {
  res.status(200).send({
    ok: true,
    service: "fastdokan-api",
    env: process.env.NODE_ENV || "development",
  });
});

app.use((error, req, res, next) => {
  if (!error) return next();

  const isCorsError = error.message?.startsWith("CORS blocked for origin:");
  const statusCode = isCorsError ? 403 : error.status || 500;

  console.error("Unhandled server error:", error);
  res.status(statusCode).send({
    ok: false,
    message: isCorsError ? error.message : "Internal server error",
  });
});

/* =====================
   SERVER + DB CONNECT
===================== */
async function startServer() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully");

    app.listen(port, () => {
      console.log(`FastDokan API running on port ${port}`);
    });
  } catch (error) {
    console.error("Server start failed:", error);
  }
}

startServer();
