// backend/src/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '127.0.0.1',       // or 'localhost'
  port: 3306,              // from 127.0.0.1:3306
  user: 'root',            // from the Workbench tile
  password: 'toor', // same one you use to log into that connection
  database: 'dailyPlanner' // the DB you created earlier
});

module.exports = pool;
