var express=                require('express');
const { WebSocketServer }=  require('ws');
var app=                    express();

//-- HTML 
//Serving the demo client to the browser
app.use(express.static('public'));
app.get('/', function(req, res){
  res.sendFile('/public/index.html', { root: __dirname })
});
app.listen(3000);

//-- WebSockets
const wss = new WebSocketServer({port: 8080});

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('close', () => console.log('Client disconnected'));

  ws.onmessage = (event) => {
    console.log(event.data);
  }
});

/*
Game Design
- Client for sending inputs and displaying content only. All game
  logic is handled on the backend.
  - demo client assumes text input only
- The content sent to the client is 'smart': i.e., entities are indicated
  by type, allowing the client to display actions according to type.
- Game content creation should be flexable, to allow any to create new games 
  using existing types.
  - defined by loading a JSON when the engine boots. 
- Two basic modes: 
  - Adventure: users interact with the world, create stuff according
    to what's available.
  - Creative: users interactivly create the world.
    - creating rooms and npcs. modifying properties via 'modify room.name' etc.
    - set/release ownership of rooms and objects.
- Type system is heirachical: 
- BaseType -> Room (has entities and objects)
           -> Object (inanimate objects)
           - Entity (has inventory, slots, health, damage) -> User
                                                           -> NPC
- Messages are sent async. Game has a 1 sec tick for entities.
- Development phases:
  - Basic World, single user moving around. look command.
    - chaning client backgroud dynamically.
    - assigning typography according to type.    - 
  - Add objects and basic interactions: look, get, drop, hold, use.
    - Add inventory, slots to user.
  - Add NPCs and basic interactions: look, say. user sees what npc does.
  - Add combat system: kill
    - handle damage, death (corpse is an entity)
  - Add object creation: create (based on objects in inventory)
  - Add economy: coins, player wallet. buy/sell from inventory to npc.
  - add inter-user interactions: tell. 
  - Add tests
*/



// setInterval(() => {
//   wss.clients.forEach((client) => {
//     client.send(new Date().toTimeString());
//   });
// }, 1000);

