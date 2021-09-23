var express = require('express');
const { WebSocketServer } = require('ws');
var app = express();

app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendFile('/public/index.html', { root: __dirname })
});

app.listen(3000);

const wss = new WebSocketServer({port: 8080});

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

setInterval(() => {
  wss.clients.forEach((client) => {
    client.send(new Date().toTimeString());
  });
}, 1000);