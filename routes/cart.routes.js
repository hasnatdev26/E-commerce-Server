const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const requireCustomer = require("../middlewares/requireCustomer");
const {
  addToCart,
  getCartByEmail,
  updateCartQuantity,
  deleteCartItem,
} = require("../controllers/cart.controller");

/* =====================
   CART ROUTES
===================== */

// Add product to cart
router.post("/carts", verifyToken, requireCustomer, addToCart);

// Get cart items by user email
router.get("/carts", verifyToken, requireCustomer, getCartByEmail);

// Update cart product quantity
router.patch("/carts/:id", verifyToken, requireCustomer, updateCartQuantity);

// Delete cart item
router.delete("/carts/:id", verifyToken, requireCustomer, deleteCartItem);

module.exports = router;
