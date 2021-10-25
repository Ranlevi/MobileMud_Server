let ws = new WebSocket('ws://localhost:8080');
let chat_display = document.getElementById('chat_display');
let dashboard= document.getElementById('dashboard');
let actions_modal = document.getElementById('actions_modal');
let actions_modal_close_btn = document.getElementById('actions_modal_close_btn');
let actions_modal_body = document.getElementById('actions_modal_body');

let stop_chat_scroll = false;

/*
todo:
https://developers.google.com/web/fundamentals/security/credential-management/save-forms
https://web.dev/sign-in-form-best-practices/
handle log in and user save

*/

chat_display.addEventListener('click', (evt)=>{
  evt.stopPropagation();

  if (evt.target.dataset.element==="pn_link"){
    actions_modal.classList.add('is-active');

    actions_modal_body.innerHTML = 
      `<ul><li>one</li><li>two</li></ul>`;

    console.log(evt.target.dataset.type);
    console.log(evt.target.dataset.id);
    console.log(evt.target.dataset.name);    
  }  
})

actions_modal_close_btn.addEventListener('click', ()=>{
  actions_modal.classList.remove('is-active');
})

chat_display.addEventListener('mousedown', (evt)=>{
  
  if (evt.target.dataset.element==="pn_link"){    
    return; //prevent action when a link is clicked
  };

  stop_chat_scroll = !stop_chat_scroll;
  if (stop_chat_scroll===true){
    chat_display.style.backgroundColor = "bisque";
  } else {
    chat_display.style.backgroundColor = "white";
  }
})

//Log in
// let login_msg = {
//   type: 'Login',
//   content: {
//     username: 'HaichiPapa',
//     password: '12345678'
//   }
// }
ws.onopen = (event) => {
  // ws.send(JSON.stringify(login_msg));
}


ws.onmessage = (event) => {
  let msg = JSON.parse(event.data);  
  
  if (msg.type==="Chat"){
    let div = document.createElement("div");
    div.classList.add("box");
    div.classList.add("chat_box");

    div.innerHTML = `${msg.content.text}`;
    chat_display.append(div);

    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }
    
  } else if (msg.type==="Status"){
    dashboard.innerHTML = `Health: ${msg.content.health}`;

  } else if (msg.type==="Login"){
    
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
  div.classList.add("chat_box");
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

let signin_form = document.getElementById("signin");
signin_form.addEventListener('submit', (evt)=>{
  evt.preventDefault();

  let login_msg = {
    type: 'Login',
    content: {
      username: null,
      password: null
    }    
  }

  let data = new FormData(evt.target);
  for (const [key, value] of data){
    if (key==="username"){
      login_msg.content.username=value;      
    } else if (key==="password"){
      login_msg.content.password=value;
    }
  }

  ws.send(JSON.stringify(login_msg));

})