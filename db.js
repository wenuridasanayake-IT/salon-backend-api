const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

db.getConnection()
.then(() => console.log('Connected to DB'))
.catch(err => console.log('DB connection failed:',err.message));

module.exports = db;