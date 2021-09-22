

// let HOST = location.origin.replace(/^http/, 'ws')
let ws = new WebSocket('ws://localhost:3000');
let el;

ws.onmessage = (event) => {
el = document.getElementById('server-time');
el.innerHTML = 'Server time: ' + event.data;
};