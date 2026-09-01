const express=require('express');
const router= require('./routes/adminRouter');
const authRouter = require("./routes/authRouter");
const app=express();
app.use(express.json());
app.use('/api/admin',router);
app.use('/api',authRouter);
app.listen(3000);