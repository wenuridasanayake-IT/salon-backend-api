const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/services',async (req, res) => {
    try{
        const [rows ]= await db.query('SELECT * FROM services');
        res.json(rows);
    }catch (err){
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }

});
module.exports = router;