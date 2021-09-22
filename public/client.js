"use strict";

let ws = new WebSocket('ws://localhost:3000');
ws.onmessage = (event) => {console.log(JSON.parse(event.data))};
