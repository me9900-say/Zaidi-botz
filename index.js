const express = require('express');
const app = express();

app.get('/health', (req,res)=>{
   res.status(200).send('ZAIDI BOT RUNNING');
});

app.get('/', (req,res)=>{
   res.sendFile(__dirname + '/pair.html');
});

__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;

app.use('/code', code);
app.use('/pair', async (req, res, next) => {
    res.sendFile(__path + '/pair.html')
});
app.use('/', async (req, res, next) => {
    res.sendFile(__path + '/main.html')
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(PORT, () => {
    console.log(`
Don't Forget To Give Star ‼️


Server running on http://localhost:` + PORT)
});

module.exports = app;

