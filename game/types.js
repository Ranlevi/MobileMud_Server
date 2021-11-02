const Utils=      require('./utils');
const World=      require('./world');

const Types = {
  Larry_Clarke: {
    props: {
      "name":             "Larry Clarke",      
      "description":      "A tall, thin man. His expression is blank and unreadable, but his dark eyes convey a sense of furious determinism.",      
      "container_id":     "3",      
      "wearing": {
        "Head":           null,
        "Torso":          null,
        "Legs":           null,
        "Feet":           null
      },
      "holding":          {
        "Hands":          null
      },
      "slots":            [],
      "slots_size_limit": 10,
      "is_fighting_with": null,
      "state_variables": {}
    },
    stm_definition: {
      initialState: "Default",
      Default: {
        actions: {
          onEnter(params_obj) {
            console.log("Default: onEnter");
          },
          onExit(params_obj){
            console.log("Default: onExit");
          }
        },
        transitions: {
          user_enters_room: {
            target: "Greeting",
            action(params_obj){
              console.log("transition action from default to greeting");
            }
          }
        }
      },
      Greeting: {
        actions: {
          onEnter(params_obj) {
            let owner= World.world.get_instance(params_obj.owner_id);
            let entity = World.world.get_instance(params_obj.sender_id);

            if (owner.props["state_variables"][entity.id]!==undefined && 
                owner.props["state_variables"][entity.id].has_entered_room){
              
                owner.say_cmd(`Hello AGAIN, ${entity.props["name"]}`);  
            } else {
              owner.say_cmd(`Hello, ${entity.props["name"]}`);
              owner.props["state_variables"][entity.id] = {
                has_entered_room: true
              }
            }
          
          },
          onExit(params_obj){
            console.log("Greeting: onExit");
          }
        },
        transitions: {
          tick: {
            target: "Default",
            action(params_obj){
              console.log("transition action from greeting to default");
            }
          }
        }
      }
    }
  }
}

exports.Types = Types;






