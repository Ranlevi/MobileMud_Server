let ws = new WebSocket('ws://localhost:8080');
let chat_display = document.getElementById('chat_display');
let dashboard= document.getElementById('dashboard');

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
  
  if (msg.type==="Chat"){
    let div = document.createElement("div");
    div.classList.add("has-text-primary");
    div.append(`${msg.content.sender}: ${msg.content.text}`);  
    chat_display.append(div);
  } else if (msg.type==="Status"){
    dashboard.innerHTML = `Health: ${msg.content.health}`
  }
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

