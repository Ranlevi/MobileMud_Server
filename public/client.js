import * as React from 'react';
import { TextField } from '@mui/material';

function App() {

    function process_input(text){
        console.log(text);
    }

    return (
        <div>
    <TextField fullWidth onChange={(event)=> process_input(event.target.value)}/>
    </div>
    )
  }
  
ReactDOM.render(<App />, document.querySelector('#app'));




let ws = new WebSocket('ws://localhost:8080');
let el;

ws.onmessage = (event) => {
el = document.getElementById('server-time');
el.innerHTML = 'Server time: ' + event.data;
};