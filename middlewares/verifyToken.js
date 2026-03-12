const jwt = require("jsonwebtoken");
const client = require("../config/db");

const userCollection = client.db("e_cormmerce").collection("users");

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }

    try {
      const dbUser = await userCollection.findOne({ email: decoded?.email });
      if (dbUser?.isBlocked) {
        return res.status(403).send({ message: "account blocked" });
      }

      req.user = decoded;
      next();
    } catch (dbError) {
      console.error("verifyToken user check error:", dbError);
      return res.status(500).send({ message: "server error" });
    }
  });
};

module.exports = verifyToken;
