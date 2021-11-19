// let ws=                       new WebSocket('ws://localhost:8080');
let ws=                       new WebSocket('ws://10.0.0.8:8080');
// let ws=                       new WebSocket('ws://192.168.0.48:8080');
let chat=                       document.getElementById('Chat');
let dashboard_text=                document.getElementById('dashboard_text');
let freeze_btn=               document.getElementById('freeze_btn');
let parent=                   document.getElementById('Parent');
let login_modal=  document.getElementById("login_modal");
let submit_btn=   document.getElementById("submit_btn");
let username_input = document.getElementById("username_input");
let password_input = document.getElementById("password_input");
let warning_text= document.getElementById("warning_text");
let input_field= document.getElementById("input_field");
let inv_btn= document.getElementById("inv_btn");
let settings_btn= document.getElementById("settings_btn");
let settings_modal= document.getElementById("settings_modal");
let settings_submit_btn= document.getElementById("settings_submit_btn");
let settings_cancel_btn= document.getElementById("settings_cancel_btn");
let description_input= document.getElementById("description_input");
let input_form= document.getElementById("input_form");

let stop_chat_scroll=       false;
let current_chat_bg_color=  "white";
let status_obj = {
  holding: "",
  head: "",
  torso: "",
  legs: "",
  feet: "",
  slots: ""
};

//Web Socket Interface
//-----------------------
//Note: On page load, the Login Modal is already displayed.
//      If login was successfull, we remove the modal.

//Handle WS messages from the server.
ws.onmessage = (event) => {
  let msg = JSON.parse(event.data);  

  switch(msg.type){
    case("Chat"):
      //Display the Chat Message as a server_box.
      let div = document.createElement("div");
      div.classList.add("box");
      div.classList.add("box_server");
      div.innerHTML = msg.content;
      chat.append(div);

      //If the chat is not frezzed, scroll it to view the latest msg.
      if (!stop_chat_scroll){
        div.scrollIntoView();  
      }
      break;

    case("Status"):
      status_obj = {
        holding: msg.content.holding,
        head: msg.content.wearing.head,
        torso: msg.content.wearing.torso,
        legs: msg.content.wearing.legs,
        feet: msg.content.wearing.feet,
        slots: msg.content.slots
      }

      let html =  `♥️ ${msg.content.health}`;
      dashboard_text.innerHTML = html;
      
      //Change the chat backgroud color.
      if (msg.content.room_lighting!==current_chat_bg_color){
        chat.style.backgroundColor = msg.content.room_lighting;
      }
      break;

    case("Login"):
      //Check if Login was successful. If true - remove modal. Else - display error.
      if (msg.content.is_login_successful){        
        login_modal.classList.remove('is-active');
      } else {
        warning_text.innerHTML = 'Wrong username/password.';
      }
      break;

    default:
      console.error(`ws.onmessage: unknown msg.type: ${msg.type}`);
  }
}

ws.onclose = function(event){
  console.log(`Connection Closed. Code: ${event.code}, Reason: ${event.reason}`);
}
 
//Login Modal
//----------------------

//Handle Login Modal
submit_btn.addEventListener('click', ()=>{

  let login_msg = {
    type: 'Login',
    content: {
      username: null,
      password: null
    }    
  }

  //Extract data from the form, and send it to the server via WS.
  let username = username_input.value;
  let password = password_input.value;

  if (username===""){
    warning_text.innerHTML = "Please enter a Name.";
  } else if (password===""){
    warning_text.innerHTML = "Please enter a Password";
  } else {
    login_msg.content.username=username;
    login_msg.content.password=password;
    ws.send(JSON.stringify(login_msg));
  }  
});

//Game Controls
//------------------

freeze_btn.addEventListener('click', ()=>{
  stop_chat_scroll = !stop_chat_scroll;

  if (stop_chat_scroll===true){
    freeze_btn.classList.remove(`has-text-success`);
    freeze_btn.classList.add('has-text-danger');    
  } else {
    freeze_btn.classList.add(`has-text-success`);
    freeze_btn.classList.remove('has-text-danger');    
    
    chat.lastElementChild.scrollIntoView();
  }
})

//Handle clicks.
chat.addEventListener('click', (evt)=>{

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
    div.classList.add("box_cmds");    
    div.innerHTML = html;    
    chat.append(div);

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
    div.classList.add("box");
    div.classList.add("box_user");    
    div.append(`${evt.target.dataset.action} ${evt.target.dataset.name}`);  
    chat.append(div);

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
    div.classList.add("box");
    div.classList.add("box_user");
    div.append(`${evt.target.dataset.actions}`);  
    chat.append(div);

    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }
    
  } else {
    input_field.focus();
  }
})

inv_btn.addEventListener('click', ()=>{

  let html = 
    `Your Inventory:`+
    `<p>&#9995; ${status_obj.holding}</p>`+
    `<p>&#x1F3A9 ${status_obj.head}</p>`+ 
    `<p>&#x1F455 ${status_obj.torso}</p>`+ 
    `<p>&#x1F456 ${status_obj.legs}</p>`+ 
    `<p>&#x1F45E ${status_obj.feet}</p>`+
    `<p>&#x1F9F3 ${status_obj.slots}</p>`;

  let div = document.createElement("div");
  div.classList.add("box");
  div.classList.add("box_server");
  div.innerHTML = html;
  chat.append(div);

  //If the chat is not frezzed, scroll it to view the latest msg.
  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }
})

settings_btn.addEventListener('click', ()=>{
  settings_modal.classList.add('is-active');
  description_input.focus();
})

settings_cancel_btn.addEventListener('click', ()=>{
  settings_modal.classList.remove('is-active');
})

settings_submit_btn.addEventListener('click', ()=>{

  if (description_input.value!==''){
    let msg = {
      type: 'Settings',
      content: {
        description: description_input.value
      }
    }
    ws.send(JSON.stringify(msg));
    settings_modal.classList.remove('is-active');
  }  
})


//Handle user input in the game i/f.
input_field.addEventListener('submit', (evt)=> { 
    
  evt.preventDefault();  

  console.log(input_form);
  
  let msg = {
    type: 'User Input',
    content: input_form.value
  }
  ws.send(JSON.stringify(msg));

  //Create a Chat box and add it to the Chat, as feedback.
  let div = document.createElement("div");
  div.classList.add("box");
  div.classList.add("box_user");
  div.innerHTML = input_form.value;
  chat.append(div);

  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }

  input_form.value = '';
  input_form.blur(); //close soft keyboard. 
  
})
