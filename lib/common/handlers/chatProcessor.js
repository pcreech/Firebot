const chat = require('../mixer-chat.js');

function textProcessor(effect, participant, control){

    try{
        // Get user specific settings
        console.log(control);
        var message = effect.message;
        var chatter = effect.chatter;
        var whisper = effect.whisper;
        var username = participant.username;
        var controlText = control.text;
        var controlCost = control.cost;
        var controlCooldown = control.cooldown;

        // Replace 'user' varibles with username
        if(message != null) {
          message = message.replace('$(user)', username);
          message = message.replace('$(text)', controlText);
          message = message.replace('$(cost)', controlCost);
          message = message.replace('$(cooldown)', controlCooldown);
        }

        // Send off the chat packet.
        if(whisper != null && whisper !== ""){
            // Send a whisper
            whisper = whisper.replace('$(user)', username);
                    
            console.log('sending text', chatter, whisper, message);
            chat.whisper(chatter, whisper, message);
        } else {
            // Send a broadcast
            console.log('sending broadcast', chatter, message);
            chat.broadcast(chatter, message);
        }
    }catch(err){
        renderWindow.webContents.send('error', "There was an error sending a chat message. If you are testing a chat button, please make sure Interactive is connected.");
        console.log(err);
    }
}


// Export Functions
exports.send = textProcessor;