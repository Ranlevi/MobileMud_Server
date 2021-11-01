let ws=                       new WebSocket('ws://localhost:8080');
// let ws=                       new WebSocket('ws://10.0.0.6:8080');
let chat_display=             document.getElementById('chat_display');
let dashboard=                document.getElementById('dashboard');
let signin_form=              document.getElementById("signin");
let login_modal_body=         document.getElementById('login_modal_body');
let login_modal=              document.getElementById('login_modal');
let input_form=               document.getElementById('input_form');
let input_field=              document.getElementById('input_field');
let freeze_btn=               document.getElementById('freeze_btn');
let parent=                   document.getElementById('parent');

let stop_chat_scroll=       false;
let current_chat_bg_color=  "bisque";

const DEBUG = true;

freeze_btn.addEventListener('click', ()=>{
  stop_chat_scroll = !stop_chat_scroll;
  if (stop_chat_scroll===true){
    freeze_btn.classList.remove(`is-primary`);
    freeze_btn.classList.add('is-danger');
    freeze_btn.innerHTML= "Unfreeze";
  } else {
    freeze_btn.classList.add(`is-primary`);
    freeze_btn.classList.remove('is-danger');
    freeze_btn.innerHTML= "Freeze";
    
    chat_display.lastElementChild.scrollIntoView();
  }
})

//Handle clicks inside the Chat display.
parent.addEventListener('click', (evt)=>{
  evt.stopPropagation();

  if (evt.target.dataset.element==="pn_link"){    

    let actions = evt.target.dataset.actions.split('_');

    let list = '';
    for (const action of actions){
      list += `<li><span class="pn_action" data-element="pn_action" ` + 
              `data-action="${action}" data-id="${evt.target.dataset.id}" ` + 
              `data-name="${evt.target.dataset.name}"> `+ 
              `${action} ${evt.target.dataset.name}</span></li>`
    }
    
    let html = `<ul>${list}</ul>`;
      
    let div = document.createElement("div");
    div.classList.add("box");
    div.classList.add("chat_box");
    div.classList.add("is-align-self-flex-end");//TODO change to center
    div.innerHTML = html;    
    chat_display.append(div);

    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }    
  
  } else if (evt.target.dataset.element==="pn_action"){

    let msg = {
      type: 'User Input',
      content: `${evt.target.dataset.action} ${evt.target.dataset.id}`
    }
    ws.send(JSON.stringify(msg));

    //Create a Chat box and add it to the Chat, as feedback.
    let div = document.createElement("div");
    div.classList.add("has-text-danger");
    div.classList.add("box");
    div.classList.add("chat_box");
    div.classList.add("is-align-self-flex-end");
    div.append(`${evt.target.dataset.action} ${evt.target.dataset.name}`);  
    chat_display.append(div);

    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }
    
  } else if (evt.target.dataset.element==="pn_cmd"){

    let msg = {
      type: 'User Input',
      content: `${evt.target.dataset.actions}`
    }
    ws.send(JSON.stringify(msg));

    //Create a Chat box and add it to the Chat, as feedback.
    let div = document.createElement("div");
    div.classList.add("has-text-danger");
    div.classList.add("box");
    div.classList.add("chat_box");
    div.classList.add("is-align-self-flex-end");
    div.append(`${evt.target.dataset.actions}`);  
    chat_display.append(div);

    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }
    
  } else {
    input_field.focus();
  }
})

//Once the Websockets i/f is open, show the login modal.
ws.onopen = (event) => {
  if (DEBUG){
    let login_msg = {
      type: 'Login',
      content: {
        username: "HaichiPapa",
        password: "12345678"
      }    
    }
    ws.send(JSON.stringify(login_msg));
  } else {
    login_modal.classList.add('is-active');
  }  
}

//Handle Form submission of Login Modal
signin_form.addEventListener('submit', (evt)=>{
  evt.preventDefault(); //Stop the form from submitting.

  let login_msg = {
    type: 'Login',
    content: {
      username: null,
      password: null
    }    
  }

  //Extract data from the form, and send it to the server via WS.
  let data = new FormData(evt.target);
  for (const [key, value] of data){
    if (key==="username"){
      login_msg.content.username=value;      
    } else if (key==="password"){
      login_msg.content.password=value;
    }
  }
  ws.send(JSON.stringify(login_msg));
});

//Handle WS messages from the server.
ws.onmessage = (event) => {
  let msg = JSON.parse(event.data);  
  
  if (msg.type==="Chat"){    
    //Create a 'msg box' and add it to the Chat dispaly.
    let div = document.createElement("div");
    div.classList.add("box");
    div.classList.add("chat_box");
    div.innerHTML = msg.content.text;
    chat_display.append(div);

    //If the chat is not frezzed, scroll it to view the latest msg.
    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }
    
  } else if (msg.type==="Status"){ 
    let html =  `♥️ ${msg.content.health} `+ 
                `<p>&#9995;  ${msg.content.holding}</p>`+
                `<p>&#x1F3A9 ${msg.content.wearing.head} `+ 
                `&#x1F455 ${msg.content.wearing.torso} `+ 
                `&#x1F456 ${msg.content.wearing.legs} `+ 
                `&#x1F45E ${msg.content.wearing.feet}</p>`+
                `<p>&#x1F9F3 ${msg.content.slots}</p>`;

    dashboard.innerHTML = html;

    if (msg.content.room_lighting!==current_chat_bg_color){
      chat_display.style.backgroundColor = msg.content.room_lighting;
    }

  } else if (msg.type==="Login"){
    //If a successful login msg is recived, remove the Login Modal and play the game.
    if (msg.content.is_login_successful){
      login_modal.classList.remove('is-active');
      
    } else {
      //Login unsuccessful.
      let div = document.createElement('div');
      div.innerHTML = 'Wrong username/password.'
      login_modal_body.insertAdjacentElement(div);
    }
  }
};

//Handle user input in the game i/f.
input_form.addEventListener('submit', (evt)=> {
  evt.preventDefault();  

  let msg = {
    type: 'User Input',
    content: input_field.value
  }
  ws.send(JSON.stringify(msg));

  //Create a Chat box and add it to the Chat, as feedback.
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
  input_field.blur(); //close soft keyboard.
})

ws.onclose = function(event){
  console.log(`Connection Closed. Code: ${event.code}, Reason: ${event.reason}`);
}