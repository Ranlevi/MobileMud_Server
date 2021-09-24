let ws = new WebSocket('ws://localhost:8080');
let chat_display = document.getElementById('chat_display');

ws.onmessage = (event) => {
  console.log(event.data);
  let div = document.createElement("div");
  div.append(event.data);
  chat_display.append(div);
};


let input_form  = document.getElementById('input_form');

input_form.addEventListener('submit', (evt)=> {
  evt.preventDefault();
  let input_field = document.getElementById('input_field');
  ws.send(input_field.value);
  
  input_field.value = '';
})