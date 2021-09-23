let ws = new WebSocket('ws://localhost:8080');
let el;

ws.onmessage = (event) => {
el = document.getElementById('server-time');
el.innerHTML = 'Server time: ' + event.data;
};