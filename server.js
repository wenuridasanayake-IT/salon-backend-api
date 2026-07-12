const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');
const PORT = 5000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());


// ========== AUTH ROUTES ==========
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email =?', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }
    
    await db.query(
      "INSERT INTO users (name, email, password, role, phone) VALUES (?,?,?,?,?)",
      [name, email, password, role || 'customer', phone]
    );
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error: " + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email =?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const user = rows[0];
    
    if (password!== user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error: " + err.message });
  }
});


// ========== APPOINTMENT ROUTES ==========
app.post('/api/appointments', async (req, res) => {
  try {
    const { user_id, service_id, appointment_datetime } = req.body;
    const [existing] = await db.query(
      "SELECT * FROM appointments WHERE appointment_datetime =? AND status!= 'cancelled'",
      [appointment_datetime]
    );
    if(existing.length > 0){
      return res.status(400).json({ message: "This time slot is already booked" });
    }
    const [staff] = await db.query("SELECT id FROM users WHERE role = 'staff' ORDER BY RAND() LIMIT 1");
    const staff_id = staff.length > 0? staff[0].id : null;
    await db.query(
      "INSERT INTO appointments (user_id, service_id, staff_id, appointment_datetime, status) VALUES (?,?,?,?, 'pending')",
      [user_id, service_id, staff_id, appointment_datetime]
    );
    res.status(201).json({ message: "Appointment booked successfully" });
  } catch (err) {
    console.log("BOOK ERROR:", err);
    res.status(500).json({ message: "Booking Failed" });
  }
});

app.get('/api/appointments/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await db.query(
      `SELECT a.*, s.name as service_name, s.price, u.name as staff_name
       FROM appointments a
       LEFT JOIN services s ON a.service_id = s.id
       LEFT JOIN users u ON a.staff_id = u.id
       WHERE a.user_id =?
       ORDER BY a.appointment_datetime DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});


// ========== ADMIN ROUTES ==========
app.get('/api/appointments/admin/all', async (req, res) => {
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

app.put('/api/appointments/admin/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.query("UPDATE appointments SET status =? WHERE id =?", [status, id]);
    res.json({ success: true, message: `Booking ${status}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ========== STAFF + OTHER ROUTES ==========
app.get('/api/appointments/staff/:staffid', async (req, res) => {
  try {
    const { staffid } = req.params;
    const [rows] = await db.query(
      `SELECT a.id, a.appointment_datetime, a.status, u.name as customer_name, s.name as service_name
       FROM appointments a
       JOIN users u ON a.user_id = u.id
       JOIN services s ON a.service_id = s.id
       WHERE a.staff_id =? ORDER BY a.appointment_datetime ASC`,
      [staffid]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { user_id, rating, comment, appointment_id} = req.body;
    await db.query(
      "INSERT INTO feedback (user_id, appointment_id, rating, comment) VALUES (?,?,?,?)",
      [user_id, appointment_id, rating, comment]
    );
    res.json({ message: "Feedback submitted Successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const { appointment_id, user_id, amount, payment_type, payment_method } = req.body;
    await db.query(
      "INSERT INTO payments (appointment_id, user_id, amount, payment_type, payment_method, status) VALUES (?,?,?,?,?,'paid')",
      [appointment_id, user_id, amount, payment_type, payment_method]
    );
    res.json({ message: "Payment Successful!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LEAVE APPLY KARANA API - STAFF
app.post('/api/staff/leave', async (req, res) => {
  try {
    const { staff_id, leave_date, reason } = req.body;
    
    if (!staff_id || !leave_date) {
      return res.status(400).json({ message: "Fill all fields" });
    }

    await db.query(
      "INSERT INTO leaves (staff_id, leave_date, reason, status) VALUES (?,?,?,?)",
      [staff_id, leave_date, reason || 'No reason', 'pending']
    );
    
    res.status(201).json({ message: "Leave request submitted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error: " + err.message });
  }
});

// GET ALL STAFF
app.get('/api/users', async (req, res) => {
  try {
    const role = req.query.role; //?role=staff
    const [rows] = await db.query("SELECT id, name, role FROM users WHERE role =?", [role]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server Error: " + err.message });
  }
});

// GET ALL LEAVES WITH STAFF NAME
app.get('/api/leaves', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT l.*, u.name as user_name FROM leaves l JOIN users u ON l.staff_id = u.id ORDER BY l.leave_date DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server Error: " + err.message });
  }
});

// LEAVE APPROVE/REJECT API
app.put('/api/leaves/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    
    await db.query("UPDATE leaves SET status = ? WHERE id = ?", [status, id]);
    res.json({ success: true, message: `Leave ${status}` });
  } catch (err) {
    res.json({ success: true });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM services");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Connected to DB`);
});