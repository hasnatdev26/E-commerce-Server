const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const {
  saveUser,
  getUserRole,
  getAllUsers, 
   checkUserEmail, 
  updateUserBlockStatus,
} = require("../controllers/user.controller");

/* =====================
   USER ROUTES
===================== */
router.post("/users/check-email", checkUserEmail); // ✅ NEW
// Get all users ✅
router.get("/users", getAllUsers);

// Save user (if not exists)
router.post("/users/:email", saveUser);

// Get user role (admin / customer)
router.get("/users/role/:email", verifyToken, getUserRole);

// Block/unblock user (admin)
router.patch("/users/:id/block", verifyToken, updateUserBlockStatus);

module.exports = router;
