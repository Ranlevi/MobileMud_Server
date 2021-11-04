const Utils=      require('./utils');
const World=      require('./world');

const Types = {
  Larry_Clarke: {
    props: {
      name:             "Larry Clarke",  
      type:             "Larry_Clarke",    
      description:      "A tall, thin man. His expression is blank and unreadable, but his dark eyes convey a sense of furious determinism.",      
      container_id:     null,      
      wearing: {
        Head:           null,
        Torso:          null,
        Legs:           null,
        Feet:           null
      },
      holding:          {
        Hands:          null
      },
      slots:            [],
      slots_size_limit: 10,
      is_fighting_with: null,
      state_variables:  {}
    },
    stm_definition: {
      initialState: "Default",
      Default: {
        actions: {
          onEnter(params_obj) {},
          onExit(params_obj) {},         
        },
        transitions: {
          user_enters_room: {
            target: "Greeting",
            action(params_obj){},            
          }
        }
      },
      Greeting: {
        actions: {
          onEnter(params_obj) {
            let owner=  World.world.get_instance(params_obj.owner_id);
            let entity= World.world.get_instance(params_obj.sender_id);

            if (owner.props.state_variables[entity.id]!==undefined &&
                owner.props.state_variables[entity.id].done_greeting){
              owner.emote_cmd(`looks at you.`);  
              owner.say_cmd(
                `No time to waste, ${entity.props.name} - `+
                `the colony needs your help.` 
                )
            } else {
            
              owner.emote_cmd(
                'raises his head from the screen. His penetrating '+
                `scans your face and body.`
                );

              owner.say_cmd(
                `So, ${entity.props.name}, you survived the Big Sleep. `+
                `Not everyone was so lucky.`
              );

              owner.say_cmd(
                `I'm guessing you're still having memory problems. That will `+
                `go away in time.`
              );

              owner.emote_cmd(
                'seems to consider his last sentence.'
                );

              owner.say_cmd(
                `If there's no permenent brain damage, that is.`
              );

              owner.say_cmd(
                `Anyway, welcome to Planet Nine. You've been asleep for `+
                `almost twenty years: 17 years of space voyage, and 3 more `+
                `years since we arrived to our Solar System's ninth planet `+
                `and erected our very first colony.`
              );

              owner.emote_cmd('scratches his head.');

              owner.say_cmd(
                `You have a lot to catch up. We discovered some very...`+
                `unusual things on this planet. But you're probably still `+
                `tired and hungry, so this might not be the best time for `+
                `lengthy explanations.`
              );

              owner.emote_cmd('points towards the door.');

              owner.say_cmd(
                `To the North you'll find a room marked as 'Storage': take `+
                `what ever you need from it, and than head East to the tunnel `+
                `that leads to the colony. Find the Mayor and tell her that `+
                `that you just woke up. She'll set you up.`
              );

              owner.emote_cmd('points to a keycard laying on the table.');

              owner.say_cmd(
                `Take this with you: you'll need it to open the AirLock.`
              );

              owner.say_cmd(
                `Ah, and one more thing: if you a sort of a...emmm...spider-thingy `+
                `crawling around the ship, don't freak out. Her name is Lamar, and `+
                `unlike some of her kind, she's well behaved.`
              );

              owner.say_cmd(
                `That's it for now. Good Luck.`
              );

              owner.emote_cmd('goes back to looking at his screen.');

              if(!owner.props.state_variables[entity.id]){
                owner.props.state_variables[entity.id] = {done_greeting: true}
              }
            }


            // if (owner.props["state_variables"][entity.id]!==undefined && 
            //     owner.props["state_variables"][entity.id].has_entered_room){
              
            //     owner.say_cmd(`Hello AGAIN, ${entity.props["name"]}`);  
            // } else {
            //   owner.say_cmd(`Hello, ${entity.props["name"]}`);
            //   owner.props["state_variables"][entity.id] = {
            //     has_entered_room: true
            //   }
            // }
          
          },
          onExit(params_obj){}
        },
        transitions: {
          tick: {
            target: "Default",
            action(params_obj){}
          }
        }
      }
    }
  },
  Keycard: {
    props: {
      name:           "A Keycard",
      type:           'Keycard',
      type_string:    "A Keycard",
      description:    "A small rectangular plastic card.",        
      container_id:   null,
      is_consumable:  false,
      hp_restored:    null,
      is_holdable:    true,
      wear_slot:      null,
      is_gettable:    true,
      key_code:       null,
      expiration_counter: 0,
      expiration_limit: 20,//continue here
    }
  }
}

exports.Types = Types;






