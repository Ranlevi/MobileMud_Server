let ws = new WebSocket('ws://localhost:8080');
let chat_display = document.getElementById('chat_display');

//Log in
let login_msg = {
  type: 'Login',
  content: {
    username: 'HaichiPapa',
    password: '12345678'
  }
}
ws.onopen = (event) => {
  ws.send(JSON.stringify(login_msg));
}


ws.onmessage = (event) => {
  let msg = JSON.parse(event.data);  
  let div = document.createElement("div");
  div.append(`${msg.sender}: ${msg.content}`);
  chat_display.append(div);
};


let input_form  = document.getElementById('input_form');

input_form.addEventListener('submit', (evt)=> {
  evt.preventDefault();
  let input_field = document.getElementById('input_field');

  let msg = {
    type: 'User Input',
    content: input_field.value
  }
  ws.send(JSON.stringify(msg));
  
  input_field.value = '';
})

ws.onclose = function(event){
  console.log(`Connection Closed. Code: ${event.code}, Reason: ${event.reason}`);
}