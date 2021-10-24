let ws = new WebSocket('ws://localhost:8080');
let chat_display = document.getElementById('chat_display');
let dashboard= document.getElementById('dashboard');

let stop_chat_scroll = false;

/*
todo:
handle link clicking via modal 
create html decoration system.
handle log in and user save

*/


chat_display.addEventListener('mousedown', ()=>{
  stop_chat_scroll = !stop_chat_scroll;
  if (stop_chat_scroll===true){
    chat_display.style.backgroundColor = "bisque";
  } else {
    chat_display.style.backgroundColor = "white";
  }
})

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
    // div.classList.add("has-text-primary");
    div.classList.add("box");    
    // div.append(`${msg.content.sender}: ${msg.content.text}`);  
    div.innerHTML = `${msg.content.text}`;
    chat_display.append(div);

    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }

    
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

  let div = document.createElement("div");
  div.classList.add("has-text-danger");
  div.classList.add("box");
  div.classList.add("is-align-self-flex-end");
  div.append(`${msg.content}`);  
  chat_display.append(div);

  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }
  
  input_field.value = '';
})

ws.onclose = function(event){
  console.log(`Connection Closed. Code: ${event.code}, Reason: ${event.reason}`);
}

