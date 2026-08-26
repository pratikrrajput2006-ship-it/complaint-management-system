// require("dotenv").config();

const pool = require("./config/db");

async function testConnection() {
    try {
        const [result] = await pool.query("SELECT 1");

        console.log("Database connected successfully");
        console.log(result);
        console.log("DB_HOST:", process.env.DB_HOST);
        console.log("DB_USER:", process.env.DB_USER);
        console.log("DB_NAME:", process.env.DB_NAME);
    } catch (error) {
        console.error("Database connection failed");
        console.error(error.message);
    }
}

testConnection();