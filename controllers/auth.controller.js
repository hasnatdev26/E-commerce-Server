const jwt = require("jsonwebtoken");
const client = require("../config/db");

const userCollection = client.db("e_cormmerce").collection("users");
const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
};

/* =====================
   GENERATE JWT
===================== */
exports.generateJWT = async (req, res) => {
  try {
    const user = req.body; // expecting { email: "abc@email.com" }
    const email = user?.email;

    if (!email) {
      return res.status(400).send({ success: false, message: "Email is required" });
    }

    const dbUser = await userCollection.findOne({ email });
    if (dbUser?.isBlocked) {
      return res
        .status(403)
        .clearCookie("token", cookieOptions)
        .send({ success: false, message: "Your account is blocked" });
    }

    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "7d",
    });

    res
      .cookie("token", token, cookieOptions)
      .send({ success: true });
  } catch (error) {
    console.error("Generate JWT error:", error);
    res.status(500).send({ success: false, message: "Failed to generate token" });
  }
};

/* =====================
   LOGOUT
===================== */
exports.logout = (req, res) => {
  res
    .clearCookie("token", cookieOptions)
    .send({ success: true });
};
