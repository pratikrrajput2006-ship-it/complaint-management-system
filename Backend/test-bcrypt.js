const bcrypt = require("bcrypt");
const password = "practice@123";

async function generatehash() {
  try {
    const value = await bcrypt.hash(password, 10);
    console.log("Original password:", password);
    console.log("Hashed password:", value);
    let a=await bcrypt.compare(password,value);
    console.log(a);
  } catch (error) {
    console.log("hashing is fail");
  }
}

generatehash();