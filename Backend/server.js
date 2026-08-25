const express=require('express');
const router= require('./routes/adminRouter');

const app=express();
app.use(express.json());
app.use('/api/admin',router);

app.listen(3000);