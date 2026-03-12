const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz-lts");
const client = require("../config/db");

/* =====================
   COLLECTIONS
===================== */
const ordersCollection = client
  .db("e_cormmerce")
  .collection("orders");

const productCollection = client
  .db("e_cormmerce")
  .collection("products");

const cartCollection = client
  .db("e_cormmerce")
  .collection("carts");

/* =====================
   HELPERS
===================== */
function generateTransactionId() {
  return `txn_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeItems(items) {
  return (items || []).map((item) => ({
    productId: item.productId || item._id,
    quantity: Number(item.quantity ?? item.cartQuantity ?? item.qty ?? 1),
    name: item.name || item.productName || "Product",
    price: Number(item.price ?? item.unitPrice ?? 0),
    image: item.image || item.cartImage || item.imageUrl || null,
    color: item.color || item.selectedColor || null,
    size: item.size || item.selectedSize || null,
  }));
}

async function reduceStockAndClearCart(order) {
  if (!order?.items?.length) return;

  for (const item of order.items) {
    if (!item.productId) continue;
    if (!ObjectId.isValid(item.productId)) continue;
    await productCollection.updateOne(
      { _id: new ObjectId(item.productId) },
      {
        $inc: {
          quantity: -Number(item.quantity || 1),
        },
      }
    );
  }

  if (order.userEmail) {
    await cartCollection.deleteMany({
      userEmail: order.userEmail,
    });
  }
}

function redirectOrJson(res, url, payload) {
  if (url) return res.redirect(url);
  return res.send(payload);
}

function getSslConfig() {
  const storeId = process.env.SSL_STORE_ID;
  const storePass = process.env.SSL_STORE_PASSWORD;
  const mode = process.env.SSL_MODE || "sandbox";
  const isLive = mode === "live";

  if (!storeId || !storePass) {
    throw new Error("Missing SSLCommerz credentials in .env");
  }

  return { storeId, storePass, isLive };
}

/* =====================
   INIT PAYMENT
===================== */
exports.initPayment = async (req, res) => {
  try {
    const {
      items,
      totalAmount,
      userEmail,
      currency = "BDT",
      customer = {},
      shipping = {},
      userName,
      phone,
      district,
      areaType,
      address,
      notes,
      totalQuantity,
      subTotal,
      deliveryFee,
      paymentMethod = "sslcommerz",
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).send({
        success: false,
        message: "Items are required",
      });
    }

    if (!totalAmount || Number(totalAmount) <= 0) {
      return res.status(400).send({
        success: false,
        message: "Valid totalAmount is required",
      });
    }

    if (!userEmail) {
      return res.status(400).send({
        success: false,
        message: "userEmail is required",
      });
    }

    const normalizedItems = normalizeItems(items);
    const transactionId = generateTransactionId();
    const serverUrl = process.env.SERVER_URL || `https://e-cormmerce-server.vercel.app`;

    // Stock check before initiating payment
    for (const item of normalizedItems) {
      if (!item.productId) {
        return res.status(400).send({
          success: false,
          message: "Invalid productId in items",
        });
      }

      if (!ObjectId.isValid(item.productId)) {
        return res.status(400).send({
          success: false,
          message: "Invalid productId",
        });
      }

      const product = await productCollection.findOne({
        _id: new ObjectId(item.productId),
      });

      if (!product) {
        return res.status(404).send({
          success: false,
          message: "Product not found",
        });
      }

      if (product.quantity < Number(item.quantity)) {
        return res.status(400).send({
          success: false,
          message: `Not enough stock for ${product.name}`,
        });
      }
    }

    // Save pending order
    await ordersCollection.insertOne({
      userEmail,
      userName,
      phone,
      district,
      areaType,
      address,
      notes,
      items: normalizedItems,
      totalAmount: Number(totalAmount),
      totalPrice: Number(totalAmount),
      totalQuantity: Number(totalQuantity || 0),
      subTotal: Number(subTotal || 0),
      deliveryFee: Number(deliveryFee || 0),
      currency,
      transactionId,
      status: "pending",
      paymentStatus: "initiated",
      paymentMethod,
      customer,
      shipping,
      orderTime: new Date(),
      orderTimestamp: Date.now(),
      createdAt: new Date(),
      createdAtTimestamp: Date.now(),
    });

    const { storeId, storePass, isLive } = getSslConfig();
    const sslcz = new SSLCommerzPayment(storeId, storePass, isLive);

    const data = {
      total_amount: Number(totalAmount),
      currency,
      tran_id: transactionId,
      success_url: `${serverUrl}/payment/success`,
      fail_url: `${serverUrl}/payment/fail`,
      cancel_url: `${serverUrl}/payment/cancel`,
      ipn_url: `${serverUrl}/payment/ipn`,
      shipping_method: "NO",
      product_name: normalizedItems[0]?.name || "E-Commerce Order",
      product_category: "General",
      product_profile: "general",
      cus_name: customer?.name || "Customer",
      cus_email: userEmail,
      cus_add1: customer?.address || "N/A",
      cus_city: customer?.city || "N/A",
      cus_postcode: customer?.postcode || "0000",
      cus_country: customer?.country || "Bangladesh",
      cus_phone: customer?.phone || "0000000000",
      ship_name: shipping?.name || customer?.name || "Customer",
      ship_add1: shipping?.address || customer?.address || "N/A",
      ship_city: shipping?.city || customer?.city || "N/A",
      ship_postcode: shipping?.postcode || customer?.postcode || "0000",
      ship_country: shipping?.country || customer?.country || "Bangladesh",
    };

    const apiResponse = await sslcz.init(data);
    const gatewayUrl = apiResponse?.GatewayPageURL;

    if (!gatewayUrl) {
      return res.status(500).send({
        success: false,
        message: "Failed to get SSLCommerz gateway URL",
      });
    }

    res.send({
      success: true,
      gatewayUrl,
      transactionId,
    });
  } catch (error) {
    console.error("SSLCommerz init error:", error);
    res.status(500).send({
      success: false,
      message: "Payment init failed",
    });
  }
};

/* =====================
   SUCCESS
===================== */
exports.handleSuccess = async (req, res) => {
  try {
    const { tran_id, val_id, status } = req.body || {};
    const clientUrl = process.env.CLIENT_URL || "https://e-cormmerce-server.vercel.app";

    if (!tran_id) {
      return res.status(400).send({
        success: false,
        message: "Transaction ID missing",
      });
    }

    const order = await ordersCollection.findOne({
      transactionId: tran_id,
    });

    if (!order) {
      return res.status(404).send({
        success: false,
        message: "Order not found",
      });
    }

    await ordersCollection.updateOne(
      { transactionId: tran_id },
      {
        $set: {
          paymentStatus: "paid",
          status: "pending",
          paymentInfo: {
            val_id: val_id || null,
            status: status || "VALID",
          },
          paidAt: new Date(),
        },
      }
    );

    await reduceStockAndClearCart(order);

    return redirectOrJson(
      res,
      clientUrl ? `${clientUrl}/success?tran_id=${tran_id}` : "",
      { success: true, transactionId: tran_id }
    );
  } catch (error) {
    console.error("SSLCommerz success error:", error);
    res.status(500).send({
      success: false,
      message: "Payment success handler failed",
    });
  }
};

/* =====================
   FAIL
===================== */
exports.handleFail = async (req, res) => {
  try {
    const { tran_id, status } = req.body || {};
    const clientUrl = process.env.CLIENT_URL || "https://e-cormmerce-server.vercel.app";

    if (tran_id) {
      await ordersCollection.updateOne(
        { transactionId: tran_id },
        {
          $set: {
            paymentStatus: "failed",
            status: "cancelled",
            paymentInfo: { status: status || "FAILED" },
            failedAt: new Date(),
          },
        }
      );
    }

    return redirectOrJson(
      res,
      clientUrl ? `${clientUrl}/payment-fail?tran_id=${tran_id || ""}` : "",
      { success: false, transactionId: tran_id }
    );
  } catch (error) {
    console.error("SSLCommerz fail error:", error);
    res.status(500).send({
      success: false,
      message: "Payment fail handler failed",
    });
  }
};

/* =====================
   CANCEL
===================== */
exports.handleCancel = async (req, res) => {
  try {
    const { tran_id, status } = req.body || {};
    const clientUrl = process.env.CLIENT_URL || "https://e-cormmerce-server.vercel.app";

    if (tran_id) {
      await ordersCollection.updateOne(
        { transactionId: tran_id },
        {
          $set: {
            paymentStatus: "cancelled",
            status: "cancelled",
            paymentInfo: { status: status || "CANCELLED" },
            cancelledAt: new Date(),
          },
        }
      );
    }

    return redirectOrJson(
      res,
      clientUrl ? `${clientUrl}/payment-cancel?tran_id=${tran_id || ""}` : "",
      { success: false, transactionId: tran_id }
    );
  } catch (error) {
    console.error("SSLCommerz cancel error:", error);
    res.status(500).send({
      success: false,
      message: "Payment cancel handler failed",
    });
  }
};

/* =====================
   IPN (OPTIONAL)
===================== */
exports.handleIpn = async (req, res) => {
  res.send({ received: true });
};
