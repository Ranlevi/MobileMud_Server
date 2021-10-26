let ws=                       new WebSocket('ws://localhost:8080');
let chat_display=             document.getElementById('chat_display');
let dashboard=                document.getElementById('dashboard');
let actions_modal=            document.getElementById('actions_modal');
let actions_modal_close_btn=  document.getElementById('actions_modal_close_btn');
let actions_modal_body=       document.getElementById('actions_modal_body');
let signin_form=              document.getElementById("signin");
let login_modal_body=         document.getElementById('login_modal_body');
let login_modal=              document.getElementById('login_modal');
let input_form=               document.getElementById('input_form');
let input_field=              document.getElementById('input_field');

let stop_chat_scroll = false;

/*
todo:
save user creditials in the browser
https://developers.google.com/web/fundamentals/security/credential-management/save-forms
https://web.dev/sign-in-form-best-practices/
*/

//Handle clicks inside the Chat display.
chat_display.addEventListener('click', (evt)=>{
  evt.stopPropagation();

  //Handle clicks on links.
  if (evt.target.dataset.element==="pn_link"){
    //Show the Actions Modal.
    actions_modal.classList.add('is-active');

    actions_modal_body.innerHTML = 
      `<ul><li>one</li><li>two</li></ul>`;

    console.log(evt.target.dataset.type);
    console.log(evt.target.dataset.id);
    console.log(evt.target.dataset.name);    
  } else {
    //This is a click on no particular element, which means 
    //that the user wishes to freeze the chat. 
    stop_chat_scroll = !stop_chat_scroll;
    if (stop_chat_scroll===true){
      chat_display.style.backgroundColor = "bisque";
    } else {
      chat_display.style.backgroundColor = "white";
    }
  }   
})

//Handle click on the 'close' btn of the Actions Modal.
actions_modal_close_btn.addEventListener('click', ()=>{
  actions_modal.classList.remove('is-active');
})

//Once the Websockets i/f is open, show the login modal.
ws.onopen = (event) => {
  login_modal.classList.add('is-active');
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
    div.innerHTML = `${msg.content.text}`;
    chat_display.append(div);

    //If the chat is not frezzed, scroll it to view the latest msg.
    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }
    
  } else if (msg.type==="Status"){
    dashboard.innerHTML = `Health: ${msg.content.health}`;

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
})

ws.onclose = function(event){
  console.log(`Connection Closed. Code: ${event.code}, Reason: ${event.reason}`);
}