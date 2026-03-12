const client = require("../config/db");

const userCollection = client
  .db("e_cormmerce")
  .collection("users");

const requireCustomer = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const user = await userCollection.findOne({ email });
    if (user?.role === "admin") {
      return res.status(403).send({
        message: "Admins cannot buy or add to cart",
      });
    }

    next();
  } catch (error) {
    console.error("Role check error:", error);
    res.status(500).send({ message: "Role check failed" });
  }
};

module.exports = requireCustomer;
