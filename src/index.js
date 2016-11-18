var APP_ID = undefined; 

var https = require('https');

var AlexaSkill = require('./AlexaSkill');

var urlPrefix = 'https://api.meetup.com/2/open_events?&sign=true&photo-host=public&country=US&key=7a2e5d4413353344474a21367a2fd31&format=json&radius=25&state=CA&status=upcoming&city=';

var paginationSize = 3;

//var delimiterSize = 2;

var EventFinderSkill = function() {
    AlexaSkill.call(this, APP_ID);
};

EventFinderSkill.prototype = Object.create(AlexaSkill.prototype);
EventFinderSkill.prototype.constructor = EventFinderSkill;

EventFinderSkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("EventFinderSkill onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session init logic would go here
};

EventFinderSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("EventFinderSkill onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    getWelcomeResponse(response);
};

EventFinderSkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session cleanup logic would go here
};

EventFinderSkill.prototype.intentHandlers = {

    "GetFirstEventIntent": function (intent, session, response) {
        handleFirstEventRequest(intent, session, response);
    },

    "GetNextEventIntent": function (intent, session, response) {
        handleNextEventRequest(intent, session, response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechText = "With Event Finder, you can get list of events in a particular city." +
            "For example, you could say Los Angeles, or Seattle, or you can say exit. Now, which city do you want?";
        var repromptText = "Which city do you want?";
        var speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var repromptOutput = {
            speech: repromptText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    }
};

/**
 * Function to handle the onLaunch skill behavior
 */

function getWelcomeResponse(response) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var cardTitle = "List of Events";
    var repromptText = "With Event Finder, you can get list of events in a particular city.";
    var speechText = "<p>Event Finder.</p> <p>What city do you want events for?</p>";
    var cardOutput = "Event Finder. What city do you want events for?";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.

    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardOutput);
}

/**
 * Gets a poster prepares the speech to reply to the user.
 */
function handleFirstEventRequest(intent, session, response) {
    var citySlot = intent.slots.city;
    var repromptText = "With Event Finder, you can get events for a particular city. For example, you could say Los Angeles, or Seattle. Now, which city do you want?";

    //var monthNames = ["January", "February", "March", "April", "May", "June",
    //                  "July", "August", "September", "October", "November", "December"];
    var sessionAttributes = {};
    // Read the first 3 events, then set the count to 3
    sessionAttributes.index = paginationSize;
    var city = "";

    // If the user provides a date, then use that, otherwise use today
    // The date is in server time, not in the user's time zone. So "today" for the user may actually be tomorrow
    if (citySlot && citySlot.value) {
        city = citySlot.value;
    } else {
        city = "Los Angeles";
    }

    var prefixContent = "<p>List of events at " + city + ", </p>";
    var cardContent = "List of events at " + city + "- ";

    var cardTitle = "Events at " + city;

    getJsonEventsFromMeetUp(city, function (events) {
        var speechText = "",
            i;
        sessionAttributes.text = events;
        session.attributes = sessionAttributes;
        if (events.length == 0) {
            speechText = "There is a problem connecting to Meet Up at this time. Please try again later.";
            cardContent = speechText;
            response.tell(speechText);
        } else {
            for (i = 0; i < paginationSize; i++) {
                cardContent = cardContent + events[i] + " ";
                speechText = "<p>" + speechText + "Event Number"+ [i+1] + "...." + events[i] + "<break time = \"2.0s\"/>" + "</p> ";
                //speechText = "<p>" + speechText + events[i] + "<break time = \"2.0s\"/>" + "</p> ";
            }
            speechText = speechText + "<p>Wanna go deeper in events list?</p>";
            var speechOutput = {
                speech: "<speak>" + prefixContent + speechText + "</speak>",
                type: AlexaSkill.speechOutputType.SSML
            };
            var repromptOutput = {
                speech: repromptText,
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
            };
            response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
        }
    });
}

/**
 * Gets a poster prepares the speech to reply to the user.
 */
function handleNextEventRequest(intent, session, response) {
    var cardTitle = "More events in this city from MeetUp",
        sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        speechText = "",
        cardContent = "",
        repromptText = "Do you want to know more about upcoming events in this city?",
        i;
    if (!result) {
        speechText = "With Event Finder, you can get list of events at a particular city. For example, you could say Los Angeles, or San Francisco. Now, which city do you want?";
        cardContent = speechText;
    } else if (sessionAttributes.index >= result.length) {
        speechText = "There are no more events at this city. Try another city by saying <break time = \"0.3s\"/> get events for Los Angeles.";
        cardContent = "There are no more events for this date. Try another date by saying, get events for Seattle.";
    } else {
        for (i = 0; i < paginationSize; i++) {
            if (sessionAttributes.index>= result.length) {
                break;
            }
            speechText = speechText + "<p>" + result[sessionAttributes.index] + "</p> ";
            cardContent = cardContent + result[sessionAttributes.index] + " ";
            sessionAttributes.index++;
        }
        if (sessionAttributes.index < result.length) {
            speechText = speechText + " Wanna go deeper in list?";
            cardContent = cardContent + " Wanna go deeper in list?";
        }
    }
    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
}

function getJsonEventsFromMeetUp(city, eventCallback) {
    var url = urlPrefix + city;

    https.get(url, function(res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            var stringResult = parseJson(body);
            eventCallback(stringResult);
        });
    }).on('error', function (e) {
        console.log("Got error: ", e);
    });
}

function parseJson(inputText) {
	
	var arr = JSON.parse(inputText);
	var out = "";
    var i;
    var retArr = [];
    for(i = 0; i < arr.results.length; i++) {
        //out += arr["results"][i].name; // logic
        retArr.push(arr["results"][i].name);
    }
	return retArr;
}
	
// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the HistoryBuff Skill.
    var skill = new EventFinderSkill();
    skill.execute(event, context);
};
