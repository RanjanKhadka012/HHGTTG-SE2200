require('dotenv').config();
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: process.env.password,
  database: 'dailyPlanner'
});

module.exports = pool;

