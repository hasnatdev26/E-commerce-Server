const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const requireCustomer = require("../middlewares/requireCustomer");

const {
  initPayment,
  handleSuccess,
  handleFail,
  handleCancel,
  handleIpn,
} = require("../controllers/payment.controller");

/* =====================
   PAYMENT ROUTES
===================== */

// Init payment
router.post("/payment/init", verifyToken, requireCustomer, initPayment);

// SSLCommerz callbacks
router.post("/payment/success", handleSuccess);
router.post("/payment/fail", handleFail);
router.post("/payment/cancel", handleCancel);
router.post("/payment/ipn", handleIpn);

module.exports = router;
