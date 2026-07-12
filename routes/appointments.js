const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. BOOK APPOINTMENT
router.post('/book', async (req, res) => {
 try {
    const { user_id, service_id, appointment_datetime } = req.body;
    const [existing] = await db.query(
      "SELECT * FROM appointments WHERE appointment_datetime =? AND status!= 'cancelled'",
      [appointment_datetime]
    );
    if(existing.length > 0){
      return res.status(400).json({ success: false, message: "This time slot is already booked" });
    }
    const [staff] = await db.query("SELECT id FROM users WHERE role = 'staff' ORDER BY RAND() LIMIT 1");
    const staff_id = staff.length > 0? staff[0].id : null;
    const [result] = await db.query(
      "INSERT INTO appointments (user_id, service_id, staff_id, appointment_datetime, status) VALUES (?,?,?,?,?)",
      [user_id, service_id, staff_id, appointment_datetime, 'pending']
    );
    res.status(201).json({ success: true, message: "Appointment Booked", appointmentId: result.insertId });
  } catch(err){
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. GET STAFF APPOINTMENTS
router.get('/staff/:staff_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.appointment_datetime, a.status, u.name as customer_name, s.name as service_name
       FROM appointments a 
       JOIN users u ON a.user_id = u.id 
       JOIN services s ON a.service_id = s.id
       WHERE a.staff_id =? ORDER BY a.appointment_datetime ASC`,
      [req.params.staff_id]
    );
    res.json(rows);
  } catch(err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. FEEDBACK
router.post('/feedback', async (req, res) => {
  // oya tiyena code eka
});

// 4. ADMIN: GET ALL APPOINTMENTS - MEKA HARI WENAS KALA
router.get('/admin/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.id, a.appointment_datetime, a.status,
      IFNULL(u.name, 'Unknown') as customer_name, 
      IFNULL(s.name, 'N/A') as service_name
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN services s ON a.service_id = s.id
      ORDER BY a.appointment_datetime DESC
    `);
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
});

// 5. ADMIN: UPDATE STATUS
router.put('/admin/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const [result] = await db.query("UPDATE appointments SET status =? WHERE id =?", [status, id]);
    res.json({ success: true, message: `Booking ${status}`, affectedRows: result.affectedRows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;