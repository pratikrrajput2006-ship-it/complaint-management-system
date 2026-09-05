const express=require('express');

const {createStaff}=require('../controller/staffController');
const router=express.Router();

router.post('/create',createStaff);

module.exports=router;