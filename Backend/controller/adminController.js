const bcrypt=require('bcrypt');
async function createAdmin(req,res){
    const {name,email,password,employee_no,designation}=req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    try{
        if(!emailRegex.test(email)||password.length<8){
        return res.status(400).json({
            "Message":"Email is not correct or password length is less"
        });
    }
    const value=await bcrypt.hash(password,10);
    res.end(value);
    }
    catch(error){
        return res.status(400).json({
            "Message":"Not work"
        });
    }
};

module.exports={createAdmin};