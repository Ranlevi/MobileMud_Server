const World=    require('./world');
const Classes=  require('./classes');

//Keeps tracks of current ID, and generates a new one.
//IDs are Strings, generated in sequencal order.
//There is a single ID_Generator instance.
class ID_Generator {
  constructor(){
    this.LENGTH=      16; 
    this.characters= 'abcdefghijklmnopqrstuvwxyz0123456789';//lowercase since input is always lowercase.  
  }
  
  get_new_id(entity_type){
    let id = ``;

    switch(entity_type){
      case "room":
        id = 'r';
        break;
      
      case "User":
        id = 'u';
        break;

      case 'Item':
        id = 'i';
        break;

      case "NPC":
        id = 'n';
        break;
    }

    let charactersLength = this.characters.length;
    for (let i = 0; i < this.LENGTH-1; i++ ) {
      id += this.characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return id;
  }
}
const id_generator_instance = new ID_Generator();

function get_opposite_direction(direction){  
  switch(direction){
    case('north'):
      return 'south';
    case('south'):
      return 'north';
    case('east'):
      return 'west';
    case('west'):
      return 'east';
    case('up'):
      return 'down';
    case('down'):
      return 'up';
  }
}

function deepCopyFunction(inObject){
  let outObject, value, key;

  if (typeof inObject !== "object" || inObject === null) {
    return inObject // Return the value if inObject is not an object
  }

  // Create an array or object to hold the values
  outObject = Array.isArray(inObject) ? [] : {}

  for (key in inObject) {
    value = inObject[key]

    // Recursively (deep) copy for nested objects, including arrays
    outObject[key] = deepCopyFunction(value)
  }

  return outObject
}

class StateMachine {
  //A machine as a value (=current state), and a function that transition it 
  //from the current state to the next state according to given event.
  constructor(stm_definition){
    this.machine = this.createMachine(stm_definition);    
  }

  createMachine(stm_definition){
    const machine = {
      current_state: stm_definition.initialState,

      transition(current_state, event, params_obj=null){        
        const currentStateDefinition= stm_definition[current_state];
        const next_state=             currentStateDefinition.transitions[event];        

        if (!next_state){
          //If the given event does not trigger a transition, return early.
          return;
        }

        // const destinationState = destinationTransition.target;
        const next_state_definition = stm_definition[next_state];
        
        //Perform the actions.        
        next_state_definition.action(params_obj);        

        //return the next state.
        machine.current_state = next_state;
        return machine.current_state;
      }      
    }
    
    return machine;
  }  
  
}
    
exports.id_generator=           id_generator_instance;
exports.get_opposite_direction= get_opposite_direction;
exports.StateMachine=           StateMachine;
exports.deepCopyFunction=       deepCopyFunction;