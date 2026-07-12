const express = require('express');
const router = express.Router();
const db = require('../db');

// FAKE SMS FUNCTION - Local nisa console eke pennai
const sendSMS = (phone, message) => {
  console.log(`📱 SMS to ${phone}: ${message}`);
  // Real unata nam: Twilio / Dialog API use karanna
}

// 1. PAYMENT KARANA API
router.post('/pay', async (req, res) => {
  try {
    const { appointment_id, user_id, amount, payment_type, payment_method } = req.body;

    let status = payment_method === 'card'? 'paid' : 'pending';

    // 1. Payment DB eke save karanna
    await db.query(
      "INSERT INTO payments (appointment_id, user_id, amount, payment_type, payment_method, status) VALUES (?,?,?,?,?,?)",
      [appointment_id, user_id, amount, payment_type, payment_method, 'paid']
    );

    // 2. Appointment status update karanna
    await db.query(
      "UPDATE appointments SET status =? WHERE id =?",
      [payment_type === 'full'? 'paid' : 'advance_paid', appointment_id]
    );

    // 3. User ge phone number eka ganna
    const [user] = await db.query("SELECT phone FROM users WHERE id =?", [user_id]);
    const phone = user[0].phone;

    // 4. SMS eka yawanna
    let msg = `Hi! Your ${payment_type} payment of Rs.${amount} for Salon Wenu is successful. Thank you!`;
    sendSMS(phone, msg);

    res.status(200).json({ success: true, message: "✅ Payment Successful! SMS sent." });
  } catch(err){
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;