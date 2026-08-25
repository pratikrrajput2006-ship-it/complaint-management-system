const pool = require("./config/db");

async function testConnection() {
    try {
        const [result] = await pool.query("SELECT 1");

        console.log("Database connected successfully");
        console.log(result);
    } catch (error) {
        console.error("Database connection failed");
        console.error(error.message);
    }
}

testConnection();