const express=require('express');
const {createStudent,getstudentProfile, updateStudentProfile}=require('../controller/studentController');
const { authMiddleware } = require('../middleware/authmiddleware');
const { rolemiddleware } = require('../middleware/rolemiddleware');

const router=express.Router();

router.post('/create',createStudent);
router.get('/dashbord',authMiddleware,rolemiddleware("Student"),(req,res)=>{
    res.status(200).json(
        {
            message:"Dashbord access successfull",
            user:req.user
        }
    );
});
router.get('/profile',authMiddleware,rolemiddleware("Student"),getstudentProfile);
router.put('/profile',authMiddleware,rolemiddleware("Student"),updateStudentProfile);
module.exports=router;
