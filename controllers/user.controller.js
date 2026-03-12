const client = require("../config/db");
const { ObjectId } = require("mongodb");

/* =====================
   COLLECTION
===================== */
const userCollection = client
  .db("e_cormmerce")
  .collection("users");

/* =====================
   SAVE USER
===================== */
exports.saveUser = async (req, res) => {
  try {
    const email = req.params.email;
    const user = req.body;

    const existingUser = await userCollection.findOne({ email });

    if (existingUser) {
      return res.status(200).send(existingUser);
    }

    // 🇧🇩 Bangladesh time
    const bdTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Dhaka",
    });

    const result = await userCollection.insertOne({
      ...user,
      email,
      role: "customer",
      isBlocked: false,
      createdAt: bdTime,
    });

    res.status(201).send(result);

  } catch (error) {
    console.error("Save user error:", error);
    res.status(500).send({ message: "Failed to save user" });
  }
};

/* =====================
   GET USER ROLE
===================== */
exports.getUserRole = async (req, res) => {
  try {
    const email = req.params.email;

    const result = await userCollection.findOne({ email });

    res.send({ role: result?.role });

  } catch (error) {
    console.error("Get user role error:", error);
    res.status(500).send({ message: "Failed to get user role" });
  }
};



/* =====================
   GET ALL USERS
===================== */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userCollection.find().toArray();
    res.send(users);
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).send({ message: "Failed to get users" });
  }
};





/* =====================
   CHECK USER EMAIL EXISTS
===================== */
exports.checkUserEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send({ exists: false, isBlocked: false });
    }

    const user = await userCollection.findOne({ email });

    if (user) {
      res.send({ exists: true, isBlocked: Boolean(user.isBlocked) });
    } else {
      res.send({ exists: false, isBlocked: false });
    }

  } catch (error) {
    console.error("Check email error:", error);
    res.status(500).send({ exists: false, isBlocked: false });
  }
};

/* =====================
   UPDATE USER BLOCK STATUS (ADMIN)
===================== */
exports.updateUserBlockStatus = async (req, res) => {
  try {
    const requesterEmail = req.user?.email;
    const { id } = req.params;
    const { isBlocked } = req.body || {};

    if (!requesterEmail) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid user id" });
    }

    if (typeof isBlocked !== "boolean") {
      return res.status(400).send({ message: "isBlocked must be boolean" });
    }

    const requester = await userCollection.findOne({ email: requesterEmail });
    if (requester?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const targetUser = await userCollection.findOne({ _id: new ObjectId(id) });
    if (!targetUser) {
      return res.status(404).send({ message: "User not found" });
    }

    if (targetUser.role?.toLowerCase() === "admin") {
      return res.status(400).send({ message: "Admin user cannot be blocked" });
    }

    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isBlocked,
          blockedAt: isBlocked ? new Date() : null,
        },
      }
    );

    res.send({
      success: true,
      modifiedCount: result.modifiedCount,
      isBlocked,
    });
  } catch (error) {
    console.error("Update user block status error:", error);
    res.status(500).send({ message: "Failed to update user block status" });
  }
};
